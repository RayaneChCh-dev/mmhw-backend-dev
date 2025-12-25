# Scheduled Events - Frontend Implementation Guide

## Overview

The backend now supports **scheduled events** with **revalidation** and **check-in** functionality. Users must schedule events at least 2 hours in advance (max 7 days). The creator must revalidate attendance 30 minutes before the event, and both users must check in when they arrive at the location.

---

## 📋 Changes from Previous System

### Before (Immediate Events)
- Events were "active" for 2 hours
- Creator posted, others requested immediately
- Once matched, event started right away

### Now (Scheduled Events)
- Events must be scheduled 2-7 days in advance (minimum 2 hours)
- Events are "scheduled" and open for requests until matched
- T-30min: Creator must revalidate (confirm + location check)
- At event time: Both users must check-in (within 100m)
- Event only truly starts when both are on-site

---

## 🔄 Event State Machine

```
SCHEDULED → MATCHED → REVALIDATION_PENDING → ACTIVE → ON_SITE_PARTIAL → ON_SITE_CONFIRMED → COMPLETED
                                ↓
                    CANCELLED_NO_REVALIDATION / CANCELLED_GEO_MISMATCH
```

### State Descriptions

| Status | Description | UI Action Required |
|--------|-------------|-------------------|
| `scheduled` | Event created, accepting requests | Show in discovery, allow requests |
| `matched` | Participant accepted, waiting for event time | Show countdown, "Event confirmed" |
| `revalidation_pending` | T-30min, waiting for creator confirmation | **Creator only**: Show revalidation dialog |
| `active` | Event time reached, users heading to location | Show "Check-in" button when within 100m |
| `on_site_partial` | One user checked in, waiting for other | Show "Waiting for partner..." |
| `on_site_confirmed` | Both checked in, event started! | Show "Good meal! Enjoy your time" |
| `completed` | Event finished, feedback submitted | Show feedback form |
| `cancelled` | Manually cancelled by creator | Show cancellation notice |
| `cancelled_no_revalidation` | Creator didn't respond to revalidation | Show timeout notice |
| `cancelled_geo_mismatch` | Creator too far from location (>10km) | Show distance issue notice |
| `expired` | No match found before event time | Archive event |

---

## 🆕 API Changes

### 1. Create Event (Modified)

**Endpoint:** `POST /events`

**New Required Fields:**
```typescript
{
  hubId: string;
  hubName: string;
  hubType: string;
  hubLocation: { lat: number; lng: number };
  hubAddress?: string;
  activityType: 'coffee' | 'cowork' | 'meal' | 'drinks' | 'walk';

  // NEW REQUIRED FIELDS
  scheduledStartTime: string; // ISO 8601 format "2026-06-14T14:00:00Z"
  duration: number; // Duration in minutes (30-480)
}
```

**Validation:**
- `scheduledStartTime` must be at least 2 hours from now
- `scheduledStartTime` must be at most 7 days from now
- `duration` must be between 30 and 480 minutes (30min - 8 hours)

**Response:**
```typescript
{
  id: string;
  status: 'scheduled';
  scheduledStartTime: string;
  duration: number;
  expiresAt: string; // 1 hour before scheduled time (deadline to find match)
  // ... other event fields
}
```

---

### 2. Revalidate Event (New)

**Endpoint:** `POST /events/:eventId/revalidate`

**When to call:** When the user receives a revalidation notification (T-30min before event)

**Request Body:**
```typescript
{
  confirmed: boolean; // true = "Yes, I'm going", false = "Cancel event"
  location: {
    lat: number; // User's current latitude
    lng: number; // User's current longitude
  }
}
```

**Responses:**

✅ **Success (confirmed + within 10km):**
```typescript
{
  message: "Event revalidated successfully. See you soon!"
}
```

❌ **Too far from event location:**
```typescript
{
  message: "Event cancelled - you are too far from the event location",
  distance: 15, // km from event
  maxDistance: 10 // km allowed
}
```
Event status becomes `cancelled_geo_mismatch`.

❌ **User declined:**
```typescript
{
  message: "Event cancelled due to no revalidation"
}
```
Event status becomes `cancelled_no_revalidation`.

**Error Cases:**
- 403: Only the event creator can revalidate
- 400: Event is not in revalidation_pending state

---

### 3. Check-In to Event (New)

**Endpoint:** `POST /events/:eventId/check-in`

**When to call:** When the user arrives at the event location (scheduled time has passed)

**Request Body:**
```typescript
{
  location: {
    lat: number; // User's current latitude
    lng: number; // User's current longitude
  }
}
```

**Responses:**

✅ **First user checked in:**
```typescript
{
  message: "Check-in successful. Waiting for the other person...",
  status: "on_site_partial"
}
```

✅ **Both users checked in:**
```typescript
{
  message: "You are both on site. Good meal!",
  status: "on_site_confirmed"
}
```

❌ **Too far from event location:**
```typescript
{
  statusCode: 400,
  message: "You must be within 100m of the event location to check in. You are 250m away."
}
```

**Error Cases:**
- 403: User is not part of this event
- 400: Event is not active for check-in
- 400: User has already checked in

---

### 4. Get Nearby Events (Modified)

**Endpoint:** `GET /events/nearby?latitude=48.8566&longitude=2.3522&radius=1500&activityType=meal`

**Change:** Now returns only events with `status: 'scheduled'` (not yet matched). Events in other states are not shown in discovery.

---

### 5. Get My Events (Modified)

**Endpoint:** `GET /events/my-events`

**Change:** Now returns events with statuses: `['scheduled', 'matched', 'revalidation_pending', 'active', 'on_site_partial', 'on_site_confirmed']`

**Response includes new fields:**
```typescript
{
  id: string;
  status: EventStatus;
  scheduledStartTime: string;
  duration: number;

  // Revalidation fields (if applicable)
  revalidationSentAt?: string;
  revalidationRespondedAt?: string;
  revalidationConfirmed?: boolean;

  // Check-in fields (if applicable)
  creatorCheckInStatus: 'pending' | 'checked_in' | 'no_show';
  participantCheckInStatus: 'pending' | 'checked_in' | 'no_show';
  creatorCheckInAt?: string;
  participantCheckInAt?: string;

  // ... other fields
}
```

---

## 🔔 Push Notifications (New Types)

### 1. Revalidation Request
**Type:** `revalidation_request`

**When:** T-30 minutes before event (sent to creator only)

**Payload:**
```typescript
{
  type: 'revalidation_request',
  eventId: string,
  scheduledStartTime: string
}
```

**Action:** Open app → Show revalidation dialog → Call `/events/:eventId/revalidate`

**Notification Text:**
- **Title:** "⏰ Event Revalidation Required"
- **Body:** "Your event is starting in 30 minutes at [HubName]. Are you still going?"

---

### 2. Revalidation Confirmed
**Type:** `revalidation_confirmed`

**When:** After creator confirms revalidation (sent to participant)

**Payload:**
```typescript
{
  type: 'revalidation_confirmed',
  eventId: string
}
```

**Action:** Show confirmation message

**Notification Text:**
- **Title:** "✅ Event Confirmed"
- **Body:** "The creator confirmed attendance for [activity] at [HubName]. See you soon!"

---

### 3. User Checked In
**Type:** `user_checked_in`

**When:** One user checks in (sent to the other user)

**Payload:**
```typescript
{
  type: 'user_checked_in',
  eventId: string,
  checkedInUserId: string
}
```

**Action:** Show "Partner arrived" message

**Notification Text:**
- **Title:** "📍 Partner Arrived"
- **Body:** "[PartnerName] is on site at [HubName], awaiting for you"

---

### 4. Both Checked In
**Type:** `both_checked_in`

**When:** Both users have checked in (sent to both)

**Payload:**
```typescript
{
  type: 'both_checked_in',
  eventId: string
}
```

**Action:** Show celebration message, event truly starts

**Notification Text:**
- **Title:** "🎉 You are both on site!"
- **Body:** "Good [activity]!"

---

### 5. Feedback Reminder (New)
**Type:** `feedback_reminder`

**When:** Event duration expires (scheduledStartTime + duration)

**Payload:**
```typescript
{
  type: 'feedback_reminder',
  eventId: string
}
```

**Action:** Navigate to feedback form

**Notification Text:**
- **Title:** "⭐ How was your experience?"
- **Body:** "Your [activity] at [HubName] has ended. Please rate your experience with [PartnerName]!"

**Note:** If no feedback is submitted within 24 hours, the event will be auto-completed by the backend.

---

### 6. Event Cancelled (Updated)
**Type:** `event_cancelled`

**When:** Event cancelled (manual, timeout, or geo-mismatch)

**Existing notification, but now can happen during revalidation too**

---

## 🌐 WebSocket Events (New)

Subscribe to `/notifications` namespace with JWT token.

### New Events to Listen For:

```typescript
// Revalidation request
socket.on('revalidation_request', (data) => {
  // data: { type, eventId, event, timestamp }
  // Show revalidation dialog
});

// User checked in
socket.on('user_checked_in', (data) => {
  // data: { type, eventId, userId, userName, timestamp }
  // Update UI to show partner arrived
});

// Both checked in
socket.on('both_checked_in', (data) => {
  // data: { type, eventId, timestamp }
  // Show celebration UI
});

// Feedback reminder
socket.on('feedback_reminder', (data) => {
  // data: { type, eventId, event, timestamp }
  // Navigate to feedback form
});
```

---

## 📱 Frontend Implementation Tasks

### 1. Event Creation Screen (Updated)

**Add to UI:**
- **Date/Time Picker**
  - Component: Date + Time selector
  - Validation: Min 2 hours from now, max 7 days
  - Default: Tomorrow at lunch/dinner time?

- **Duration Picker**
  - Component: Duration selector (30min, 1h, 1.5h, 2h, 3h, 4h, etc.)
  - Validation: 30-480 minutes
  - Default: 120 minutes (2 hours)

**Example UI:**
```
Create Event
━━━━━━━━━━━━━━━━━━━
📍 Location: [Selected Hub]
🎯 Activity: [Meal ▼]

📅 Scheduled Date & Time
[Tomorrow ▼] at [2:00 PM ▼]

⏱️ Duration
[2 hours ▼]

[Create Event]
```

**Form Data:**
```typescript
const createEvent = async () => {
  const scheduledStartTime = new Date(selectedDate.setHours(selectedHour, selectedMinute));

  await api.post('/events', {
    hubId,
    hubName,
    hubType,
    hubLocation: { lat, lng },
    hubAddress,
    activityType,
    scheduledStartTime: scheduledStartTime.toISOString(),
    duration: selectedDuration, // in minutes
  });
};
```

---

### 2. Revalidation Dialog (New)

**Trigger:** When receiving `revalidation_request` notification

**UI Flow:**
1. Show modal/dialog (cannot dismiss)
2. Display countdown: "You have X minutes to respond"
3. Get user's current location
4. Two buttons:
   - "Yes, I'm going" → Call API with confirmed: true
   - "Cancel event" → Call API with confirmed: false

**Example UI:**
```
⏰ Event Revalidation
━━━━━━━━━━━━━━━━━━━━━━━━

Your event is starting in 30 minutes!

📍 Coffee at Starbucks Downtown
🕐 Today at 2:00 PM

Are you still going?

⏱️ Please respond in the next 10 minutes

[Yes, I'm going!]  [Cancel Event]
```

**Implementation:**
```typescript
const handleRevalidation = async (confirmed: boolean) => {
  // Get user's current location
  const location = await getCurrentLocation();

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
      showError(`You are ${error.response.data.distance}km from the event location. Maximum allowed: ${error.response.data.maxDistance}km`);
    }
  }
};
```

**Error Handling:**
- If location permission denied → Show error, cannot revalidate
- If too far (>10km) → Show distance error, event auto-cancelled
- If timeout (10min) → Event auto-cancelled by backend

---

### 3. Check-In Button (New)

**When to Show:**
- Event status is `active` or `on_site_partial`
- Current time >= scheduledStartTime
- User is within reasonable distance (~500m to show button, but validates 100m on backend)

**UI States:**

**State 1: Not in range**
```
━━━━━━━━━━━━━━━━━━━━━━━━
📍 Event Location: 250m away

Get closer to check in

[Navigate to location]
━━━━━━━━━━━━━━━━━━━━━━━━
```

**State 2: In range, ready to check in**
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

**Implementation:**
```typescript
const handleCheckIn = async () => {
  // Get current location
  const location = await getCurrentLocation();

  // Calculate distance to event location
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
    // Update event status in UI
    updateEventStatus(response.status);
  } catch (error) {
    if (error.response?.data?.message?.includes('within 100m')) {
      showError(error.response.data.message);
    }
  }
};
```

---

### 4. Event List/Card UI Updates

**Add to Event Card:**

**For Scheduled Events:**
```
━━━━━━━━━━━━━━━━━━━
🍽️ Meal at Le Café

📅 Tomorrow, June 14
🕐 2:00 PM (2h duration)

👤 John Doe
━━━━━━━━━━━━━━━━━━━
```

**For Matched Events (waiting):**
```
━━━━━━━━━━━━━━━━━━━
🍽️ Meal at Le Café

📅 Tomorrow, June 14
🕐 2:00 PM
✓ Matched with John

⏳ Starts in 5 hours
━━━━━━━━━━━━━━━━━━━
```

**For Revalidation Pending:**
```
━━━━━━━━━━━━━━━━━━━
🍽️ Meal at Le Café

⏰ REVALIDATION NEEDED
📅 Starts in 25 minutes

[Respond Now]
━━━━━━━━━━━━━━━━━━━
```

**For Active (check-in time):**
```
━━━━━━━━━━━━━━━━━━━
🍽️ Meal at Le Café

📍 250m away
🕐 Happening now

[Check In When Close]
━━━━━━━━━━━━━━━━━━━
```

---

### 5. Location Permissions

**Request Permissions:**
```typescript
// Request location permission on app start or when needed
const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    // Show alert explaining why location is needed
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

### 6. Background Location Tracking (Optional)

**Purpose:** Show check-in button automatically when user is close to event location

**Implementation:**
```typescript
// Start tracking when event becomes active
const startEventLocationTracking = async (event) => {
  if (event.status !== 'active') return;

  await Location.startLocationUpdatesAsync('event-tracking', {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 50, // Update every 50m
    foregroundService: {
      notificationTitle: 'Event Active',
      notificationBody: 'Tracking your location for check-in',
    },
  });
};

// Handle location updates
TaskManager.defineTask('event-tracking', ({ data, error }) => {
  if (error) return;

  const { locations } = data;
  const currentLocation = locations[0];

  // Calculate distance to event
  const distance = calculateDistance(
    currentLocation.coords.latitude,
    currentLocation.coords.longitude,
    event.hubLocation.lat,
    event.hubLocation.lng
  );

  // Notify user when close enough
  if (distance <= 100) {
    showNotification('You can check in now!');
  }
});

// Stop tracking after check-in or event completion
const stopEventLocationTracking = async () => {
  await Location.stopLocationUpdatesAsync('event-tracking');
};
```

---

## 🎨 UI/UX Recommendations

### Event Discovery
- **Filter by date/time:** "Today", "Tomorrow", "This Weekend", "Next Week"
- **Show countdown:** "Starts in 3 hours" or "Tomorrow at 2:00 PM"
- **Badge for urgency:** "Filling Fast" if event is close to scheduled time

### Event Timeline View
```
My Event: Coffee at Starbucks
━━━━━━━━━━━━━━━━━━━━━━━━

Timeline:
✓ Created        Dec 24, 10:00 AM
✓ Matched        Dec 24, 11:30 AM
  → with John Doe

⏰ Revalidation   Dec 25, 1:30 PM
  (30 min before)

📍 Event Time     Dec 25, 2:00 PM
  Check in when you arrive

⏱️ Duration       2 hours
```

### Error States
- **Revalidation timeout:** "Event cancelled - You didn't confirm in time"
- **Too far:** "Event cancelled - You were 15km away (max 10km)"
- **Check-in failed:** "You must be within 100m to check in. You are 250m away."

### Success States
- **Event created:** "Event scheduled for [date] at [time]!"
- **Revalidation confirmed:** "Great! See you at [location] in 30 minutes"
- **First check-in:** "Checked in! Waiting for your partner..."
- **Both checked in:** "🎉 You're both here! Enjoy your [activity]!"

---

## 🧪 Testing Scenarios

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

## 📊 Configuration Values (Reference)

These are set in the backend and cannot be changed from the frontend:

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_SCHEDULE_HOURS` | 2 hours | Minimum advance scheduling time |
| `MAX_SCHEDULE_DAYS` | 7 days | Maximum advance scheduling time |
| `REVALIDATION_MINUTES_BEFORE` | 30 min | When to send revalidation request |
| `REVALIDATION_TIMEOUT_MINUTES` | 10 min | Time to respond to revalidation |
| `HOME_DISTANCE_KM` | 10 km | Max distance from event during revalidation |
| `CHECK_IN_DISTANCE_METERS` | 100 m | Max distance to check in at event |

---

## 🔐 Security Notes

1. **Location Privacy:** Never store or log exact user locations in frontend. Pass directly to API.
2. **Location Permissions:** Request permissions with clear explanation of why they're needed
3. **Background Tracking:** Optional feature, must be clearly communicated to users
4. **Fake Check-ins:** Backend validates distance server-side, but add client-side checks to prevent accidental attempts

---

## 📦 Required Packages (Expo)

```bash
npx expo install expo-location
npx expo install @react-native-async-storage/async-storage
npx expo install expo-task-manager # if using background location
npx expo install expo-notifications # for push notifications
```

---

## 🚀 Summary for Frontend Team

### Must Implement:
1. ✅ **Date/Time picker** in create event form
2. ✅ **Duration picker** in create event form
3. ✅ **Revalidation dialog** (triggered by push notification)
4. ✅ **Check-in button** with distance calculation
5. ✅ **Location permissions** handling
6. ✅ **New push notification types** handling
7. ✅ **UI state updates** for new event statuses

### Nice to Have:
- Background location tracking for auto check-in prompts
- Event timeline/progress visualization
- Map view showing event location and user distance
- Rich push notifications with quick actions

### Breaking Changes:
- `POST /events` now requires `scheduledStartTime` and `duration`
- `GET /events/nearby` only returns `scheduled` events
- Event objects now have many more fields (check-in status, revalidation data)

---

## 📞 Support

If you have questions about the backend implementation or need clarification on any endpoint behavior, please reach out. The backend is fully functional and tested - all migrations have been applied successfully! 🎉
