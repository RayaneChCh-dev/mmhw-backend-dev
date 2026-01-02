# Immediate Events - Frontend Implementation Guide

## Overview

The backend now supports **two types of events**: **immediate** and **scheduled**.

- **Scheduled Events**: Follow the complex flow with revalidation and check-in (see `SCHEDULED_EVENTS_FRONTEND_IMPLEMENTATION.md`)
- **Immediate Events**: Simple, instant events for users already at a location

---

## 🆚 Comparison

| Feature | Immediate Events | Scheduled Events |
|---------|------------------|------------------|
| **Creation** | Instant, no scheduling | Must be 2+ hours in advance |
| **Initial Status** | `active` | `scheduled` |
| **Validation** | Minimal | Extensive (time, revalidation, check-in) |
| **Flow** | `active` → `on_site_confirmed` → `completed` | `scheduled` → `matched` → `revalidation_pending` → `active` → `on_site_partial` → `on_site_confirmed` → `completed` |
| **Duration** | 2 hours (expires if no match) | Custom (30-480 minutes) |
| **Location Check** | None | Required (revalidation + check-in) |
| **Use Case** | "I'm at a cafe NOW" | "Let's meet tomorrow at 2pm" |

---

## 🔄 Immediate Event Flow

```
1. User creates immediate event → Status: active (2hr expiry)
   ↓
2. Other users see it in discovery (nearby events)
   ↓
3. Someone requests to join
   ↓
4. Creator accepts → Status: on_site_confirmed (starts immediately!)
   ↓
5. Both users submit feedback → Status: completed
```

**Key Point**: When creator accepts, the event immediately becomes `on_site_confirmed` - no waiting, no revalidation, no check-in.

---

## 📋 API Changes

### 1. Create Immediate Event (New)

**Endpoint:** `POST /events/immediate`

**Request Body:**
```typescript
{
  hubId: string;              // Google Places ID
  hubName: string;            // Name of location
  hubType: string;            // restaurant, cafe, bar, etc.
  hubLocation: {              // Coordinates
    lat: number;
    lng: number;
  };
  hubAddress?: string;        // Optional address
  activityType: 'coffee' | 'cowork' | 'meal' | 'drinks' | 'walk';
}
```

**Response:**
```typescript
{
  id: string;
  eventType: 'immediate';
  status: 'active';           // Starts active immediately
  expiresAt: string;          // 2 hours from creation
  creatorId: string;
  hubId: string;
  hubName: string;
  hubLocation: { lat: number; lng: number };
  activityType: string;
  createdAt: string;
  // ... other fields
}
```

**Validation:**
- User cannot have another active immediate event
- No scheduling or duration required

---

### 2. Get Nearby Events (Updated)

**Endpoint:** `GET /events/nearby?latitude=48.8566&longitude=2.3522&radius=1500`

**Response now includes both:**
- Scheduled events with `status: 'scheduled'`
- Immediate events with `status: 'active'` and `eventType: 'immediate'`

**Example Response:**
```typescript
[
  {
    id: "...",
    eventType: "immediate",      // ← Check this field
    status: "active",
    activityType: "coffee",
    hubName: "Starbucks Downtown",
    expiresAt: "2026-01-02T14:30:00Z",  // 2 hours from creation
    creator: { ... }
  },
  {
    id: "...",
    eventType: "scheduled",       // ← Scheduled event
    status: "scheduled",
    scheduledStartTime: "2026-01-03T14:00:00Z",
    duration: 120,
    activityType: "meal",
    hubName: "Le Café",
    creator: { ... }
  }
]
```

---

### 3. Request to Join (Unchanged)

**Endpoint:** `POST /events/requests`

Works the same for both event types.

---

### 4. Accept Request (Updated Behavior)

**Endpoint:** `POST /events/requests/:requestId/respond`

**Request Body:**
```typescript
{
  response: 'accepted' | 'declined'
}
```

**Behavior Change:**
- **Scheduled events**: Status becomes `matched` (wait for revalidation)
- **Immediate events**: Status becomes `on_site_confirmed` (event starts immediately!)

---

## 📱 Frontend Implementation

### 1. Add Event Type Selection

**Event Creation Screen:**
```jsx
<EventCreationScreen>
  {/* Toggle between Immediate and Scheduled */}
  <SegmentedControl>
    <Segment value="immediate">Now</Segment>
    <Segment value="scheduled">Schedule</Segment>
  </SegmentedControl>

  {eventType === 'immediate' ? (
    <ImmediateEventForm />
  ) : (
    <ScheduledEventForm />
  )}
</EventCreationScreen>
```

---

### 2. Immediate Event Form

**Simple form (no date/time picker):**
```jsx
<ImmediateEventForm>
  <Text>🚀 Create an event right now</Text>
  <Text>You're at a location and want to meet someone immediately</Text>

  <LocationPicker
    label="Where are you?"
    onSelect={handleLocationSelect}
  />

  <ActivityTypePicker
    value={activityType}
    onChange={setActivityType}
  />

  <Text>⏱️ This event will be active for 2 hours</Text>

  <Button onPress={createImmediateEvent}>
    Create Event Now
  </Button>
</ImmediateEventForm>
```

**API Call:**
```typescript
const createImmediateEvent = async () => {
  try {
    const response = await api.post('/events/immediate', {
      hubId,
      hubName,
      hubType,
      hubLocation: { lat, lng },
      hubAddress,
      activityType,
    });

    showSuccess('Event created! Others can now request to join.');
    navigation.navigate('MyEvents');
  } catch (error) {
    if (error.response?.data?.message?.includes('already have an active')) {
      showError('You already have an active immediate event. Complete or cancel it first.');
    }
  }
};
```

---

### 3. Event Discovery UI

**Show both event types:**
```jsx
<EventCard event={event}>
  {/* Badge to indicate event type */}
  {event.eventType === 'immediate' ? (
    <Badge color="green">🚀 Happening Now</Badge>
  ) : (
    <Badge color="blue">📅 Scheduled</Badge>
  )}

  <Title>{event.activityType} at {event.hubName}</Title>

  {/* Show different time info based on type */}
  {event.eventType === 'immediate' ? (
    <Text>⏱️ Expires in {getTimeUntil(event.expiresAt)}</Text>
  ) : (
    <Text>📅 {formatDate(event.scheduledStartTime)}</Text>
  )}

  <Creator>{event.creator.firstName}</Creator>

  <Button onPress={() => requestToJoin(event.id)}>
    Request to Join
  </Button>
</EventCard>
```

---

### 4. My Events Screen

**Handle different statuses:**
```jsx
const renderEventStatus = (event) => {
  if (event.eventType === 'immediate') {
    switch (event.status) {
      case 'active':
        return (
          <>
            <StatusBadge color="green">🚀 Active Now</StatusBadge>
            <Text>Waiting for someone to join...</Text>
            <Text>⏱️ Expires in {getTimeUntil(event.expiresAt)}</Text>
          </>
        );

      case 'on_site_confirmed':
        return (
          <>
            <StatusBadge color="success">🎉 Event Started!</StatusBadge>
            <Text>You're meeting with {getPartnerName(event)}</Text>
            <Button onPress={() => submitFeedback(event.id)}>
              Submit Feedback
            </Button>
          </>
        );

      case 'completed':
        return <StatusBadge>✓ Completed</StatusBadge>;

      case 'expired':
        return <StatusBadge color="gray">⏱️ Expired (no match found)</StatusBadge>;
    }
  } else {
    // Handle scheduled event statuses
    // (see SCHEDULED_EVENTS_FRONTEND_IMPLEMENTATION.md)
  }
};
```

---

### 5. Notifications

Immediate events use the same notifications as scheduled events:
- `event_request`: Someone wants to join your event
- `request_accepted`: Your request was accepted
- `event_cancelled`: Event was cancelled

**No new notification types needed!**

---

### 6. Event Details Screen

**Show different info based on type:**
```typescript
<EventDetailsScreen event={event}>
  <Header>
    {event.eventType === 'immediate' ? '🚀 Immediate Event' : '📅 Scheduled Event'}
  </Header>

  <Location>{event.hubName}</Location>
  <Activity>{event.activityType}</Activity>

  {event.eventType === 'immediate' ? (
    <>
      <InfoRow>
        <Label>Status</Label>
        <Value>{event.status === 'active' ? 'Active Now' : 'Started'}</Value>
      </InfoRow>
      <InfoRow>
        <Label>Expires</Label>
        <Value>{formatTime(event.expiresAt)}</Value>
      </InfoRow>
    </>
  ) : (
    <>
      <InfoRow>
        <Label>Scheduled Time</Label>
        <Value>{formatDateTime(event.scheduledStartTime)}</Value>
      </InfoRow>
      <InfoRow>
        <Label>Duration</Label>
        <Value>{event.duration} minutes</Value>
      </InfoRow>
    </>
  )}
</EventDetailsScreen>
```

---

## 🎯 Key Differences for Frontend

### Immediate Events:
- ✅ **Simple creation** - No date/time picker
- ✅ **Instant status** - Starts as `active` immediately
- ✅ **No revalidation** - Skip all that complexity
- ✅ **No check-in** - No location validation
- ✅ **Fast flow** - Accepted → Started → Completed
- ✅ **2-hour window** - Fixed duration

### Scheduled Events:
- ❌ **Complex creation** - Date/time + duration picker
- ❌ **Multi-stage flow** - Many status transitions
- ❌ **Revalidation required** - T-30min confirmation
- ❌ **Check-in required** - Location validation
- ❌ **Slower flow** - Multiple steps before starting

---

## 🧪 Testing Checklist

### Test Immediate Events:
- [ ] Create immediate event
- [ ] See immediate event in nearby discovery
- [ ] Request to join immediate event
- [ ] Accept request → Event immediately becomes `on_site_confirmed`
- [ ] Submit feedback → Event becomes `completed`
- [ ] Let immediate event expire (2 hours) → Status becomes `expired`
- [ ] Try to create another immediate event while one is active → Error

### Test Both Types Together:
- [ ] Discovery shows both immediate and scheduled events
- [ ] Can create scheduled event while having immediate event (and vice versa)
- [ ] UI correctly displays badges/status for each type
- [ ] Correct flow for each type (no revalidation for immediate)

---

## 💡 UI/UX Recommendations

### Event Discovery:
- **Filter option**: "Show only immediate events" or "Show only scheduled events"
- **Sort by**: Immediate events first (more urgent)
- **Badges**: Clear visual distinction (green for immediate, blue for scheduled)

### Event Creation:
- **Default to immediate** if user is at a location (detected via GPS)
- **Tooltip**: "Create an immediate event if you're already at a location"

### My Events:
- **Separate tabs**: "Active Now" (immediate) vs "Scheduled"
- **Countdown**: Show time remaining for immediate events prominently

---

## 📦 Summary

### Backend Added:
- ✅ `POST /events/immediate` endpoint
- ✅ `eventType` field on all events
- ✅ Different flow for accepting immediate event requests
- ✅ Cron jobs skip revalidation/check-in for immediate events

### Frontend Needs:
1. **Toggle** between immediate/scheduled in event creation
2. **Simple form** for immediate events (no date/time)
3. **Badge** showing event type in discovery
4. **Different status display** based on event type
5. **Handle** immediate `on_site_confirmed` status (no check-in flow)

---

## 🚀 Migration from Old System

If you had immediate events before (status went straight to `active`), this new system is **very similar**:
- Same simple flow
- Same 2-hour duration
- Only difference: Now explicitly marked as `eventType: 'immediate'`

The scheduled events are the new addition with all the complexity (revalidation, check-in, etc.)

---

## ❓ FAQ

**Q: Can a user have both an immediate and scheduled event?**
A: No. Users can only have one active event at a time (either type).

**Q: Do immediate events support chat?**
A: Yes! Chat works the same for both types once matched.

**Q: Can I schedule an immediate event for later?**
A: No. That's what scheduled events are for. Immediate = NOW.

**Q: What happens if no one joins my immediate event?**
A: After 2 hours, it expires automatically (status: `expired`).

**Q: Do immediate events appear in "events at hub"?**
A: Yes, both types appear in nearby/hub queries.

---

For scheduled events implementation details, see: `SCHEDULED_EVENTS_FRONTEND_IMPLEMENTATION.md`
