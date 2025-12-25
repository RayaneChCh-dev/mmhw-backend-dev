# Frontend Implementation Summary - Scheduled Events

## Overview

The backend now supports **scheduled events** with **revalidation** (T-30min) and **check-in** functionality. This document summarizes what was implemented in the backend and what needs to be built in the frontend.

---

## What Changed in Backend

### 1. Event Creation - Now Requires Scheduling

**Endpoint:** `POST /events`

**New Required Fields:**
```typescript
{
  // ... existing fields (hubId, hubName, hubLocation, activityType, etc.)

  // NEW REQUIRED FIELDS
  scheduledStartTime: string; // ISO 8601 format "2026-06-14T14:00:00Z"
  duration: number; // Duration in minutes (30-480)
}
```

**Validation Rules:**
- `scheduledStartTime` must be **at least 2 hours from now**
- `scheduledStartTime` must be **at most 7 days from now**
- `duration` must be between 30 and 480 minutes

**No more immediate events** - Everything must be scheduled at least 2 hours in advance.

---

### 2. Event State Machine

```
SCHEDULED
  ↓ (user requests & creator accepts)
MATCHED
  ↓ (T-30min: revalidation notification sent)
REVALIDATION_PENDING
  ↓ (creator confirms + within 10km)
ACTIVE
  ↓ (one user checks in)
ON_SITE_PARTIAL
  ↓ (both users check in)
ON_SITE_CONFIRMED
  ↓ (event ends, feedback submitted)
COMPLETED

Cancel States:
- CANCELLED (manual cancellation)
- CANCELLED_NO_REVALIDATION (creator didn't respond)
- CANCELLED_GEO_MISMATCH (creator too far during revalidation)
- EXPIRED (no match found before event time)
```

---

### 3. New API Endpoints

#### **Revalidate Event** (T-30min Check)
```
POST /events/:eventId/revalidate

Request Body:
{
  confirmed: boolean,  // true = "Yes, I'm going", false = "Cancel event"
  location: {
    lat: number,
    lng: number
  }
}

Success Response:
{
  message: "Event revalidated successfully. See you soon!"
}

Error Responses:
- Too far (>10km): { message: "Event cancelled - you are too far...", distance: 15, maxDistance: 10 }
- User declined: { message: "Event cancelled due to no revalidation" }
```

**When to call:** When user receives `revalidation_request` notification (T-30min before event)

**Who can call:** Only the event creator

#### **Check-In to Event**
```
POST /events/:eventId/check-in

Request Body:
{
  location: {
    lat: number,
    lng: number
  }
}

Success Responses:
- First user: { message: "Check-in successful. Waiting for the other person...", status: "on_site_partial" }
- Both users: { message: "You are both on site. Good meal!", status: "on_site_confirmed" }

Error Response:
- Too far (>100m): { statusCode: 400, message: "You must be within 100m of the event location..." }
```

**When to call:** When event time arrives and user is at the location

**Who can call:** Both creator and participant

---

### 4. Modified API Endpoints

#### **Get Nearby Events**
```
GET /events/nearby?latitude=48.8566&longitude=2.3522&radius=1500&activityType=meal
```
**Change:** Now returns only events with `status: 'scheduled'` (not yet matched)

#### **Get My Events**
```
GET /events/my-events
```
**Change:** Returns events with new statuses and includes new fields:

```typescript
{
  id: string;
  status: EventStatus;
  scheduledStartTime: string;
  duration: number;

  // Revalidation fields
  revalidationSentAt?: string;
  revalidationRespondedAt?: string;
  revalidationConfirmed?: boolean;

  // Check-in fields
  creatorCheckInStatus: 'pending' | 'checked_in' | 'no_show';
  participantCheckInStatus: 'pending' | 'checked_in' | 'no_show';
  creatorCheckInAt?: string;
  participantCheckInAt?: string;
}
```

---

### 5. New Push Notifications

#### **Revalidation Request** (T-30min)
```typescript
{
  type: 'revalidation_request',
  eventId: string,
  scheduledStartTime: string
}
```
**Title:** "⏰ Event Revalidation Required"
**Body:** "Your event is starting in 30 minutes at [HubName]. Are you still going?"
**Action:** Show revalidation dialog (cannot dismiss)

#### **Revalidation Confirmed**
```typescript
{
  type: 'revalidation_confirmed',
  eventId: string
}
```
**Title:** "✅ Event Confirmed"
**Body:** "The creator confirmed attendance for [activity] at [HubName]. See you soon!"

#### **User Checked In**
```typescript
{
  type: 'user_checked_in',
  eventId: string,
  checkedInUserId: string
}
```
**Title:** "📍 Partner Arrived"
**Body:** "[PartnerName] is on site at [HubName], awaiting for you"

#### **Both Checked In**
```typescript
{
  type: 'both_checked_in',
  eventId: string
}
```
**Title:** "🎉 You are both on site!"
**Body:** "Good [activity]!"

#### **Feedback Reminder** (New)
```typescript
{
  type: 'feedback_reminder',
  eventId: string
}
```
**Title:** "⭐ How was your experience?"
**Body:** "Your [activity] at [HubName] has ended. Please rate your experience with [PartnerName]!"

**Note:** Sent when event duration expires (scheduledStartTime + duration). If no feedback is submitted within 24 hours, the event will be auto-completed by the backend.

---

### 6. New WebSocket Events

**Namespace:** `/notifications`

```typescript
// Listen for revalidation request
socket.on('revalidation_request', (data) => {
  // data: { type, eventId, event, timestamp }
  // Show revalidation dialog
});

// Listen for user checked in
socket.on('user_checked_in', (data) => {
  // data: { type, eventId, userId, userName, timestamp }
  // Update UI to show partner arrived
});

// Listen for both checked in
socket.on('both_checked_in', (data) => {
  // data: { type, eventId, timestamp }
  // Show celebration UI
});

// Listen for feedback reminder
socket.on('feedback_reminder', (data) => {
  // data: { type, eventId, event, timestamp }
  // Navigate to feedback form
});
```

---

## Frontend Implementation Tasks

### ✅ Task 1: Update Event Creation Form

**Add to UI:**
1. **Date/Time Picker**
   - Min: 2 hours from now
   - Max: 7 days from now
   - Default: Tomorrow at lunch/dinner time

2. **Duration Picker**
   - Options: 30min, 1h, 1.5h, 2h, 3h, 4h, etc.
   - Range: 30-480 minutes
   - Default: 120 minutes (2 hours)

**Example Code:**
```typescript
const createEvent = async () => {
  const scheduledStartTime = new Date(selectedDate);
  scheduledStartTime.setHours(selectedHour, selectedMinute);

  // Validate minimum 2 hours
  const minTime = new Date();
  minTime.setHours(minTime.getHours() + 2);

  if (scheduledStartTime < minTime) {
    alert('Event must be scheduled at least 2 hours in advance');
    return;
  }

  await api.post('/events', {
    // ... existing fields
    scheduledStartTime: scheduledStartTime.toISOString(),
    duration: selectedDuration, // in minutes
  });
};
```

---

### ✅ Task 2: Implement Revalidation Dialog

**Trigger:** When receiving `revalidation_request` push notification or WebSocket event

**UI Requirements:**
- Modal/dialog that cannot be dismissed
- Show countdown: "You have X minutes to respond"
- Two buttons: "Yes, I'm going" and "Cancel event"

**Example Code:**
```typescript
const handleRevalidation = async (confirmed: boolean) => {
  // Get user's current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  try {
    const response = await api.post(`/events/${eventId}/revalidate`, {
      confirmed,
      location: {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      },
    });

    if (confirmed) {
      showSuccess(response.message);
    } else {
      showInfo('Event cancelled');
    }
  } catch (error) {
    if (error.response?.data?.message?.includes('too far')) {
      showError(
        `You are ${error.response.data.distance}km from the event location. ` +
        `Maximum allowed: ${error.response.data.maxDistance}km`
      );
    }
  }
};
```

**Error Handling:**
- Location permission denied → Show error, cannot revalidate
- Too far (>10km) → Show distance error, event auto-cancelled
- Timeout (10min) → Event auto-cancelled by backend

---

### ✅ Task 3: Implement Check-In Button

**When to Show:**
- Event status is `active` or `on_site_partial`
- Current time >= scheduledStartTime
- User is within reasonable distance (show at ~500m, validate at 100m)

**UI States:**

**State 1: Not in range yet**
```
━━━━━━━━━━━━━━━━━━━━━━━━
📍 Event Location: 250m away

Get closer to check in

[Navigate to location]
━━━━━━━━━━━━━━━━━━━━━━━━
```

**State 2: In range, ready**
```
━━━━━━━━━━━━━━━━━━━━━━━━
📍 You're close!

[✓ I'm Here - Check In]
━━━━━━━━━━━━━━━━━━━━━━━━
```

**State 3: Checked in, waiting**
```
━━━━━━━━━━━━━━━━━━━━━━━━
✓ You've checked in

Waiting for [Partner Name]...
━━━━━━━━━━━━━━━━━━━━━━━━
```

**State 4: Both checked in**
```
━━━━━━━━━━━━━━━━━━━━━━━━
🎉 You're both here!

Good meal! Enjoy your time.
━━━━━━━━━━━━━━━━━━━━━━━━
```

**Example Code:**
```typescript
const handleCheckIn = async () => {
  // Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  // Calculate distance to event location (optional client-side check)
  const distance = calculateDistance(
    location.coords.latitude,
    location.coords.longitude,
    event.hubLocation.lat,
    event.hubLocation.lng
  );

  if (distance > 500) {
    showError('You need to be closer to the event location');
    return;
  }

  try {
    const response = await api.post(`/events/${eventId}/check-in`, {
      location: {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      },
    });

    showSuccess(response.message);
    updateEventStatus(response.status);
  } catch (error) {
    if (error.response?.data?.message?.includes('within 100m')) {
      showError(error.response.data.message);
    }
  }
};

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
```

---

### ✅ Task 4: Update Event List/Card UI

**Show scheduled time and countdown:**

```typescript
// For scheduled events
<EventCard>
  <Icon>🍽️</Icon>
  <Title>Meal at Le Café</Title>
  <DateTime>
    📅 {formatDate(event.scheduledStartTime)}
  </DateTime>
  <DateTime>
    🕐 {formatTime(event.scheduledStartTime)} ({event.duration}min)
  </DateTime>
  <Creator>👤 {event.creator.firstName}</Creator>
</EventCard>

// For matched events
<EventCard>
  <Icon>🍽️</Icon>
  <Title>Meal at Le Café</Title>
  <DateTime>
    📅 {formatDate(event.scheduledStartTime)}
  </DateTime>
  <DateTime>
    🕐 {formatTime(event.scheduledStartTime)}
  </DateTime>
  <Status>✓ Matched with {event.participant.firstName}</Status>
  <Countdown>⏳ Starts in {getTimeUntil(event.scheduledStartTime)}</Countdown>
</EventCard>

// For revalidation pending (URGENT)
<EventCard>
  <Icon>🍽️</Icon>
  <Title>Meal at Le Café</Title>
  <Status style={{ color: 'red', fontWeight: 'bold' }}>
    ⏰ REVALIDATION NEEDED
  </Status>
  <DateTime>
    📅 Starts in {getTimeUntil(event.scheduledStartTime)}
  </DateTime>
  <Button onPress={openRevalidationDialog}>Respond Now</Button>
</EventCard>

// For active (check-in time)
<EventCard>
  <Icon>🍽️</Icon>
  <Title>Meal at Le Café</Title>
  <Distance>📍 {distanceToEvent}m away</Distance>
  <Status>🕐 Happening now</Status>
  <Button onPress={handleCheckIn} disabled={distanceToEvent > 500}>
    Check In When Close
  </Button>
</EventCard>
```

---

### ✅ Task 5: Location Permissions

**Request Permissions:**
```typescript
import * as Location from 'expo-location';

// Request location permission
const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    Alert.alert(
      'Location Permission Required',
      'We need your location to:\n• Verify attendance during revalidation\n• Check you in when you arrive at events',
      [{ text: 'OK' }]
    );
    return false;
  }

  return true;
};

// Get current location
const getCurrentLocation = async () => {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) throw new Error('Location permission denied');

  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
};
```

**When to Request:**
1. During revalidation flow
2. When user attempts to check in
3. Optionally: Background tracking when event is active (for "check in" button availability)

---

### ✅ Task 6: Handle New Push Notifications

**Update notification handler:**
```typescript
// In your push notification handler
const handleNotification = (notification) => {
  const { type, eventId } = notification.data;

  switch (type) {
    case 'revalidation_request':
      // Show revalidation dialog (cannot dismiss)
      navigation.navigate('RevalidationDialog', { eventId });
      break;

    case 'revalidation_confirmed':
      // Show confirmation message
      showToast('Event confirmed! See you soon!');
      break;

    case 'user_checked_in':
      // Update event UI
      showToast('Your partner has arrived!');
      refreshEventDetails(eventId);
      break;

    case 'both_checked_in':
      // Show celebration
      showCelebration('You are both on site! Good meal!');
      refreshEventDetails(eventId);
      break;

    case 'feedback_reminder':
      // Navigate to feedback form
      navigation.navigate('FeedbackForm', { eventId });
      break;

    case 'event_cancelled':
      // Show cancellation notice
      showAlert('Event Cancelled', notification.message);
      refreshEventList();
      break;

    // ... other notification types
  }
};
```

---

### ✅ Task 7: Update WebSocket Listeners

```typescript
import { io } from 'socket.io-client';

// Connect to WebSocket
const socket = io('YOUR_BACKEND_URL/notifications', {
  auth: {
    token: userJwtToken,
  },
});

// Listen for connection
socket.on('connected', (data) => {
  console.log('Connected to notifications:', data);
});

// Listen for revalidation request
socket.on('revalidation_request', (data) => {
  console.log('Revalidation request:', data);
  navigation.navigate('RevalidationDialog', { eventId: data.eventId });
});

// Listen for user checked in
socket.on('user_checked_in', (data) => {
  console.log('User checked in:', data);
  showToast(`${data.userName} has arrived!`);
  refreshEventDetails(data.eventId);
});

// Listen for both checked in
socket.on('both_checked_in', (data) => {
  console.log('Both checked in:', data);
  showCelebration('You are both on site! Good meal!');
  refreshEventDetails(data.eventId);
});

// Listen for feedback reminder
socket.on('feedback_reminder', (data) => {
  console.log('Feedback reminder:', data);
  navigation.navigate('FeedbackForm', { eventId: data.eventId });
});

// Health check
socket.on('pong', (data) => {
  console.log('Pong received:', data);
});

// Send ping every 30 seconds
setInterval(() => {
  socket.emit('ping');
}, 30000);
```

---

## Configuration Values

These constants are set in the backend and cannot be changed from frontend:

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_SCHEDULE_HOURS` | 2 hours | Minimum advance scheduling time |
| `MAX_SCHEDULE_DAYS` | 7 days | Maximum advance scheduling time |
| `REVALIDATION_MINUTES_BEFORE` | 30 min | When to send revalidation request |
| `REVALIDATION_TIMEOUT_MINUTES` | 10 min | Time to respond to revalidation |
| `HOME_DISTANCE_KM` | 10 km | Max distance from event during revalidation |
| `CHECK_IN_DISTANCE_METERS` | 100 m | Max distance to check in at event |
| `FEEDBACK_REMINDER_HOURS` | 24 hours | Auto-complete event after feedback reminder |

---

## Required Packages (Expo)

```bash
npx expo install expo-location
npx expo install expo-notifications
npx expo install @react-native-async-storage/async-storage
npx expo install expo-task-manager  # Optional: for background location tracking
```

---

## Testing Scenarios

### Scenario 1: Happy Path
1. User A creates scheduled event (tomorrow 2 PM, 2 hours duration)
2. User B requests to join
3. User A accepts → Event status: `matched`
4. **Tomorrow 1:30 PM:** User A receives revalidation notification
5. User A confirms (within 10km) → Event status: `active`
6. **Tomorrow 2:00 PM:** Event time arrives
7. User A arrives, checks in (within 100m) → Event status: `on_site_partial`
8. User B arrives, checks in (within 100m) → Event status: `on_site_confirmed`
9. Both submit feedback → Event status: `completed`

### Scenario 2: Revalidation Timeout
1-3. Same as above
4. **Tomorrow 1:30 PM:** User A receives revalidation notification
5. User A doesn't respond for 10 minutes
6. **Tomorrow 1:40 PM:** Backend auto-cancels → Event status: `cancelled_no_revalidation`
7. User B receives cancellation notification

### Scenario 3: Too Far at Revalidation
1-3. Same as above
4. **Tomorrow 1:30 PM:** User A receives revalidation notification
5. User A confirms but is 15km away from event location
6. Backend cancels → Event status: `cancelled_geo_mismatch`
7. User B receives cancellation notification

### Scenario 4: Check-in Distance Check
1-7. Same as Scenario 1
8. User A tries to check in from 200m away
9. API returns error: "You must be within 100m..."
10. User A gets closer, tries again at 80m
11. Check-in succeeds

---

## Breaking Changes

⚠️ **Important for Frontend:**

1. **`POST /events` now requires `scheduledStartTime` and `duration`** - Update your event creation form
2. **`GET /events/nearby` only returns `scheduled` events** - Events in other states won't appear in discovery
3. **Event objects now have many more fields** - Update your TypeScript interfaces
4. **No more immediate events** - Remove any UI for creating immediate events

---

## Summary

**Backend is fully implemented and tested.** All migrations have been applied successfully. The backend now:
- ✅ Requires all events to be scheduled at least 2 hours in advance
- ✅ Sends revalidation notifications 30 minutes before event
- ✅ Validates creator's location during revalidation (must be within 10km)
- ✅ Auto-cancels events if revalidation times out (10 minutes)
- ✅ Validates user proximity for check-ins (must be within 100m)
- ✅ Tracks check-in status for both users
- ✅ Sends push notifications and WebSocket events for all critical actions
- ✅ Handles all state transitions automatically via cron jobs

**Frontend needs to implement:**
- Date/time picker for event creation
- Revalidation dialog (T-30min)
- Check-in button with distance tracking
- New notification handlers
- WebSocket event listeners
- UI updates for new event statuses

For more detailed implementation examples, see `SCHEDULED_EVENTS_FRONTEND_IMPLEMENTATION.md` in the backend folder.
