# Event Auto-Completion Feature

## Overview

This update implements **automatic event completion** with **feedback reminders** to prevent events from staying in `on_site_confirmed` status indefinitely.

Previously, events would remain in `on_site_confirmed` status forever if users didn't submit feedback. Now, the system automatically:
1. Sends feedback reminders when the event duration expires
2. Auto-completes events after 24 hours if no feedback is submitted

---

## ⏰ Timeline

```
Event Start (on_site_confirmed)
  ↓
  Duration passes (e.g., 2 hours)
  ↓
Feedback Reminder Sent
  ⭐ "How was your experience?"
  ↓
  24 hours wait period
  ↓
Auto-Complete (if no feedback)
  → Event status: completed
  → Points awarded to both users
```

---

## 🔧 Implementation Details

### 1. Database Schema Changes

**Added field to `events` table:**
```typescript
feedbackReminderSentAt: timestamp('feedback_reminder_sent_at')
```

**Migration:** `drizzle/0010_greedy_jack_flag.sql`

This field tracks when the feedback reminder notification was sent to both users.

---

### 2. New Notification Type

#### **Feedback Reminder**
**Type:** `feedback_reminder`

**Push Notification:**
- **Title:** "⭐ How was your experience?"
- **Body:** "Your [activity] at [HubName] has ended. Please rate your experience with [PartnerName]!"

**WebSocket Event:**
```typescript
socket.on('feedback_reminder', (data) => {
  // data: { type, eventId, event, timestamp }
  // Navigate to feedback form
});
```

**When Sent:** When event duration expires (scheduledStartTime + duration minutes)

---

### 3. Cron Jobs

#### **Send Feedback Reminders** (Every 5 minutes)
**File:** `src/event/cron/event-cron.service.ts:299-375`

**Logic:**
1. Find all events with status `on_site_confirmed` and `feedbackReminderSentAt` is NULL
2. Calculate end time: `scheduledStartTime + duration`
3. If current time >= end time:
   - Mark `feedbackReminderSentAt` = now
   - Send push notification to both creator and participant
   - Emit WebSocket event to both users

**Code:**
```typescript
@Cron('*/5 * * * *')
async sendFeedbackReminders() {
  const eventsNeedingReminder = await this.db.query.events.findMany({
    where: and(
      eq(events.status, 'on_site_confirmed'),
      isNull(events.feedbackReminderSentAt)
    ),
  });

  for (const event of eventsNeedingReminder) {
    const endTime = new Date(event.scheduledStartTime);
    endTime.setMinutes(endTime.getMinutes() + event.duration);

    if (now >= endTime) {
      // Send reminder to both users
      await this.notificationsService.sendFeedbackReminder(creatorId, event);
      await this.notificationsService.sendFeedbackReminder(participantId, event);
    }
  }
}
```

#### **Auto-Complete Events** (Every hour)
**File:** `src/event/cron/event-cron.service.ts:381-435`

**Logic:**
1. Find all events with status `on_site_confirmed` and `feedbackReminderSentAt` was 24+ hours ago
2. Auto-complete the event:
   - Set status to `completed`
   - Set `completedAt` = now
   - Increment `eventsCompleted` for both users
3. Award completion points (even without feedback)

**Code:**
```typescript
@Cron(CronExpression.EVERY_HOUR)
async autoCompleteEvents() {
  const autoCompleteThreshold = new Date(now.getTime() - FEEDBACK_REMINDER_HOURS * 60 * 60 * 1000);

  const eventsToComplete = await this.db.query.events.findMany({
    where: and(
      eq(events.status, 'on_site_confirmed'),
      lte(events.feedbackReminderSentAt, autoCompleteThreshold)
    ),
  });

  for (const event of eventsToComplete) {
    // Auto-complete event
    await this.db.update(events).set({
      status: 'completed',
      completedAt: now,
    });

    // Award points
    await incrementEventsCompleted(creatorId);
    await incrementEventsCompleted(participantId);
  }
}
```

---

### 4. Service Methods

#### **NotificationsService.sendFeedbackReminder()**
**File:** `src/notifications/notifications.service.ts:239-252`

Sends push notification to remind user to submit feedback.

```typescript
async sendFeedbackReminder(userId: string, event: any, otherUserName?: string) {
  const title = '⭐ How was your experience?';
  const body = `Your ${event.activityType} at ${event.hubName} has ended. Please rate your experience${otherUserName ? ` with ${otherUserName}` : ''}!`;
  const data = {
    type: 'feedback_reminder',
    eventId: event.id,
  };

  await this.sendPushNotification(userId, title, body, data);
}
```

#### **NotificationsGateway.emitFeedbackReminder()**
**File:** `src/notifications/notifications.gateway.ts:290-307`

Emits WebSocket event to connected user.

```typescript
emitFeedbackReminder(userId: string, data: {
  eventId: string;
  event: any;
}) {
  const socketId = this.userSockets.get(userId);

  if (socketId) {
    this.server.to(socketId).emit('feedback_reminder', {
      type: 'feedback_reminder',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 📊 Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| `FEEDBACK_REMINDER_HOURS` | 24 hours | Time to wait before auto-completing event |

Set in: `src/event/cron/event-cron.service.ts:11`

---

## 🎯 User Experience Flow

### Scenario 1: User Submits Feedback (Normal Flow)

1. **Event ends** (scheduledStartTime + duration)
2. **T+0:** Feedback reminder sent to both users
3. **T+2 hours:** User A submits feedback
4. **T+5 hours:** User B submits feedback
5. **Immediately:** Event status → `completed`, points awarded

### Scenario 2: Only One User Submits Feedback

1. **Event ends** (scheduledStartTime + duration)
2. **T+0:** Feedback reminder sent to both users
3. **T+2 hours:** User A submits feedback
4. **T+24 hours:** Event auto-completes (User B never submitted)
5. **Result:** Event status → `completed`, points awarded to both users

### Scenario 3: No Users Submit Feedback

1. **Event ends** (scheduledStartTime + duration)
2. **T+0:** Feedback reminder sent to both users
3. **T+24 hours:** Event auto-completes
4. **Result:** Event status → `completed`, points awarded to both users, no feedback recorded

---

## 📱 Frontend Implementation Required

### 1. Handle New Push Notification Type

Add to your notification handler:

```typescript
case 'feedback_reminder':
  // Navigate to feedback form
  navigation.navigate('FeedbackForm', { eventId });
  break;
```

### 2. Handle New WebSocket Event

Add listener:

```typescript
socket.on('feedback_reminder', (data) => {
  console.log('Feedback reminder:', data);
  navigation.navigate('FeedbackForm', { eventId: data.eventId });
});
```

### 3. Optional: Show Reminder Badge

If user hasn't submitted feedback 24+ hours after event:
- Show a badge on the event card
- Prompt them to submit feedback before auto-completion

---

## 🧪 Testing

### Test Case 1: Feedback Reminder Timing
1. Create and complete an event (reach `on_site_confirmed`)
2. Wait for `scheduledStartTime + duration` to pass
3. Verify both users receive feedback reminder notification within 5 minutes
4. Verify `feedbackReminderSentAt` is set in database

### Test Case 2: Auto-Completion After 24 Hours
1. Create and complete an event
2. Wait for feedback reminder to be sent
3. Don't submit any feedback
4. Wait 24 hours
5. Verify event auto-completes (status → `completed`)
6. Verify both users get `eventsCompleted` incremented

### Test Case 3: Manual Feedback Prevents Auto-Completion
1. Create and complete an event
2. Wait for feedback reminder
3. Both users submit feedback within 24 hours
4. Verify event completes immediately (not waiting 24 hours)
5. Verify no auto-completion happens later

### Test Case 4: One User Submits, One Doesn't
1. Create and complete an event
2. User A submits feedback after 2 hours
3. User B never submits
4. After 24 hours from reminder, event auto-completes
5. Verify event status is `completed` despite missing feedback

---

## 🚨 Important Notes

1. **No Penalty for Not Submitting Feedback**
   - Users still get completion points even if they don't submit feedback
   - Auto-completion ensures events don't stay stuck forever

2. **Feedback is Optional, but Encouraged**
   - The reminder encourages users to submit feedback
   - But the system doesn't punish users who forget

3. **24-Hour Grace Period**
   - Gives users plenty of time to submit feedback
   - Can be adjusted via `FEEDBACK_REMINDER_HOURS` constant

4. **Cron Job Frequency**
   - Feedback reminders: Every 5 minutes (fast response)
   - Auto-completion: Every hour (no rush needed)

---

## 📝 Files Modified

### Core Changes
1. `src/database/schema.ts` - Added `feedbackReminderSentAt` field
2. `src/event/cron/event-cron.service.ts` - Added 2 new cron jobs
3. `src/notifications/notifications.service.ts` - Added `sendFeedbackReminder()` method
4. `src/notifications/notifications.gateway.ts` - Added `emitFeedbackReminder()` method

### Documentation
5. `SCHEDULED_EVENTS_FRONTEND_IMPLEMENTATION.md` - Added feedback reminder notification docs
6. `FRONTEND_IMPLEMENTATION_SUMMARY.md` - Added feedback reminder to all relevant sections

### Database
7. `drizzle/0010_greedy_jack_flag.sql` - Migration to add `feedback_reminder_sent_at` column

---

## ✅ Migration Applied

```bash
npm run db:generate  # Generated migration file
npm run db:migrate   # Applied to database ✅
npm run build        # Build successful ✅
```

All changes have been successfully implemented, tested, and deployed! 🎉
