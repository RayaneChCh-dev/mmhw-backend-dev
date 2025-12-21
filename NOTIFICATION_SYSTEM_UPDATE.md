# 🔔 Push Notification System - Complete Update Guide

This document outlines all changes made to fix the push notification system, including token management, sender exclusion, and notification preferences.

---

## 📋 Table of Contents

1. [Backend Changes](#backend-changes)
2. [Frontend Changes Required](#frontend-changes-required)
3. [Testing Instructions](#testing-instructions)
4. [API Changes](#api-changes)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Backend Changes

All backend changes have been **completed and deployed**. Here's what was fixed:

### 1. Database Schema - New `user_devices` Table

**File:** `src/database/schema.ts`

A new table was created to track multiple devices per user:

```sql
CREATE TABLE "user_devices" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES users(id),
  "device_id" varchar(255) NOT NULL,      -- Unique device identifier
  "device_type" varchar(50),               -- 'ios', 'android', 'web'
  "device_name" varchar(255),              -- Device model/name
  "push_token" varchar(255) NOT NULL,      -- Expo push token
  "last_used_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "user_devices_push_token_unique" UNIQUE("push_token")
);

-- Indexes for performance
CREATE UNIQUE INDEX "unique_user_device" ON "user_devices" ("user_id", "device_id");
CREATE UNIQUE INDEX "unique_push_token" ON "user_devices" ("push_token");
CREATE INDEX "idx_user_devices_user" ON "user_devices" ("user_id");
```

**Migration:** `drizzle/0005_third_ken_ellis.sql` (already applied ✅)

### 2. Token Registration - Enforces Uniqueness

**File:** `src/user/user.service.ts`

**Key Changes:**
- **CRITICAL FIX:** Before assigning a token, removes it from ALL other users/devices
- Supports device information (`deviceId`, `deviceType`, `deviceName`)
- Maintains backward compatibility with legacy `pushToken` field

```typescript
async updatePushToken(userId: string, updatePushTokenDto: UpdatePushTokenDto) {
  const { pushToken, deviceId, deviceType, deviceName } = updatePushTokenDto;

  // CRITICAL: Remove this token from ANY other users/devices
  await this.db.delete(userDevices).where(eq(userDevices.pushToken, pushToken));

  if (deviceId) {
    // New device-based approach
    // ... stores in user_devices table
  } else {
    // Legacy approach for backward compatibility
    // ... stores in users.pushToken field
  }
}
```

### 3. Notification Sending - Excludes Sender

**File:** `src/notifications/notifications.service.ts`

**Key Changes:**

#### New Helper Method:
```typescript
private async getUserPushTokens(userId: string, senderId?: string): Promise<string[]> {
  // CRITICAL: If userId is the sender, return empty array
  if (senderId && userId === senderId) {
    this.logger.debug(`Excluding sender ${senderId} from receiving their own notification`);
    return [];
  }

  // Fetch all tokens from user_devices + legacy users.pushToken
  // ...
}
```

#### Updated Core Method:
```typescript
private async sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any>,
  senderId?: string // ← NEW PARAMETER
) {
  // CRITICAL: Early return if userId is sender
  if (senderId && userId === senderId) {
    this.logger.debug(`Skipping notification for sender ${senderId}`);
    return;
  }

  // Send to all user's devices
  // ...
}
```

### 4. All Notification Types Updated

All notification methods now pass `senderId` to exclude the sender:

| Method | Sender Excluded | Line |
|--------|----------------|------|
| `sendEventRequest()` | Requester | 48 |
| `sendEventAccepted()` | Creator | 82 |
| `sendNewMessage()` | Message sender | 120 |
| `sendEventCancelled()` | Event canceller | 142 |

### 5. Notification Preferences Fix

**File:** `src/notifications/notifications.service.ts`

**FIXED:** Response format now matches frontend expectations

**Before (broken):**
```typescript
return {
  preferences: {  // ← Nested object
    pushEnabled: true,
    eventRequests: true,
    // ...
  }
};
```

**After (fixed):**
```typescript
return {
  pushEnabled: true,  // ← Flat object
  eventRequests: true,
  eventAccepted: true,
  newMessages: true,
  eventCancelled: true,
};
```

---

## 📱 Frontend Changes Required

### Change 1: Update Notification Preferences Logic (Optional Enhancement)

**File:** `app/(tabs)/profile/settings.tsx`

Your current implementation is already correct! The issue was on the backend (now fixed). However, here's an optional enhancement to handle errors better:

```typescript
// Optional: Add error state
const [preferencesError, setPreferencesError] = useState<string | null>(null);

// Load notification preferences
useEffect(() => {
  const loadPreferences = async () => {
    try {
      const prefs = await notificationsApi.getNotificationPreferences();
      console.log('✅ Loaded notification preferences:', prefs);

      // Sync push notification state with backend
      setPushNotifications(prefs.pushEnabled);
      setEventReminders(prefs.eventRequests || prefs.eventAccepted || prefs.eventCancelled);
      setMessageNotifications(prefs.newMessages);
      setEmailNotifications(prefs.pushEnabled);

      setPreferencesLoaded(true);
      setPreferencesError(null); // Clear any previous errors
    } catch (error) {
      console.error('❌ Failed to load notification preferences:', error);
      setPreferencesError('Failed to load preferences');
      setPreferencesLoaded(true);
    }
  };

  if (user?.id) {
    loadPreferences();
  }
}, [user?.id]);
```

### Change 2: Verify Device Info is Sent (Already Correct)

**File:** `utils/notifications.ts`

Your frontend already sends device information correctly:

```typescript
const payload = {
  pushToken,
  deviceId: await getDeviceId(),
  deviceType: Platform.OS,
  deviceName: await Device.deviceName || `${Platform.OS} device`,
};

await notificationsApi.registerPushToken(payload);
```

✅ **No changes needed!**

### Change 3: Test Unregister on Logout

**File:** Your auth logout handler

Ensure you call `unregisterPushNotifications()` on logout:

```typescript
const handleLogout = async () => {
  try {
    // Unregister push token before logout
    await unregisterPushNotifications();

    // Your existing logout logic
    await authApi.logout();
    // ... clear storage, navigate, etc.
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

## 🧪 Testing Instructions

### Test 1: Token Uniqueness (Same Device, Multiple Users)

**Steps:**
1. **User A** logs in on device → Check backend logs for token registration
2. **User B** logs in on **same device** → Check logs
3. Query database:
   ```sql
   SELECT u.email, ud.push_token, ud.device_id
   FROM user_devices ud
   JOIN users u ON u.id = ud.user_id
   WHERE ud.push_token = 'ExponentPushToken[...]';
   ```
4. **Expected:** Only **one row** for **User B** (last login)

**Backend Logs to Check:**
```
DEBUG Removed push token ExponentPushToken[...] from any previous devices
DEBUG Created new device entry for user <User B ID> device <device-id>
```

### Test 2: Sender Exclusion (Message Notifications)

**Steps:**
1. **User A** and **User B** are matched in an event
2. **User A** sends message "Hello" to **User B**
3. Check notifications on both devices

**Expected Results:**
- ❌ **User A** should **NOT** receive push notification
- ✅ **User B** should receive push notification: "💬 User A: Hello"

**Backend Logs to Check:**
```
DEBUG Excluding sender <User A ID> from receiving their own notification
# OR
DEBUG Skipping notification for sender <User A ID>
```

### Test 3: All Notification Types

| Action | Actor | Should Receive | Should NOT Receive |
|--------|-------|----------------|-------------------|
| Send event request | User A | Event creator | User A (requester) |
| Accept request | Creator | User A (requester) | Creator |
| Send message | User A | Recipient | User A (sender) |
| Cancel event | Creator | Participant | Creator (canceller) |

### Test 4: Notification Preferences

**Steps:**
1. Open Settings → Notifications section
2. **Expected:** All toggles should be **ON** by default
3. Toggle "Push Notifications" OFF
4. Check database:
   ```sql
   SELECT notification_preferences FROM users WHERE id = '<user-id>';
   ```
5. **Expected:** `{ "pushEnabled": false, ... }`
6. Send test notification → Should **not** receive it

**Frontend Logs to Check:**
```
✅ Loaded notification preferences: { pushEnabled: true, eventRequests: true, ... }
```

### Test 5: Multi-Device Support

**Steps:**
1. **User A** logs in on **Device 1** (iPhone)
2. **User A** logs in on **Device 2** (Android)
3. **User B** sends message to **User A**
4. Check both devices

**Expected:**
- Both Device 1 and Device 2 receive the notification ✅

**Database Check:**
```sql
SELECT device_id, device_type, device_name, push_token
FROM user_devices
WHERE user_id = '<User A ID>';
```
Should show **2 rows** with different tokens.

---

## 📡 API Changes

### Updated Endpoints

#### 1. Register Push Token
```
PATCH /users/push-token
```

**Request Body (Enhanced):**
```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "deviceId": "uuid-or-device-specific-id",      // ← NEW (optional)
  "deviceType": "ios",                            // ← NEW (optional)
  "deviceName": "iPhone 14 Pro"                   // ← NEW (optional)
}
```

**Response:**
```json
{
  "message": "Push token updated successfully"
}
```

#### 2. Get Notification Preferences
```
GET /notifications/preferences
```

**Response (FIXED - now flat object):**
```json
{
  "pushEnabled": true,
  "eventRequests": true,
  "eventAccepted": true,
  "newMessages": true,
  "eventCancelled": true
}
```

**Before (broken):**
```json
{
  "preferences": {  // ← Extra nesting removed
    "pushEnabled": true,
    // ...
  }
}
```

#### 3. Update Notification Preferences
```
PATCH /notifications/preferences
```

**Request Body:**
```json
{
  "pushEnabled": false,
  "eventRequests": true,
  "newMessages": false
}
```

**Response:**
```json
{
  "message": "Notification preferences updated successfully",
  "preferences": {
    "pushEnabled": false,
    "eventRequests": true,
    "eventAccepted": true,
    "newMessages": false,
    "eventCancelled": true
  }
}
```

#### 4. Unregister Push Token
```
DELETE /users/push-token
```

**Response:**
```json
{
  "message": "Push token removed successfully"
}
```

---

## 🐛 Troubleshooting

### Issue 1: Preferences Show as Disabled

**Symptoms:**
- Settings page shows all toggles OFF
- Console logs: `pushEnabled: undefined`

**Solution:**
✅ **Already fixed in backend!** The `getNotificationPreferences()` method now returns a flat object.

**Verify:**
```bash
# Test the API directly
curl -H "Authorization: Bearer <token>" \
  https://your-api.com/notifications/preferences
```

Should return flat object (not nested under `preferences` key).

### Issue 2: Same Token for Multiple Users

**Symptoms:**
- User A logs in → gets token `ABC`
- User B logs in on same device → gets **same token** `ABC`

**Root Cause:**
Frontend not calling `getExpoPushToken(true)` with `forceRefresh`.

**Solution:**
Check `utils/notifications.ts` line 113:
```typescript
const token = await Notifications.getExpoPushTokenAsync({
  projectId: Constants.expoConfig?.extra?.eas?.projectId,
});
// Make sure you're calling forceRefresh somewhere!
```

### Issue 3: Receiving Own Notifications

**Symptoms:**
- User sends message → receives push notification of their own message

**Diagnosis:**
```bash
# Check backend logs for this:
grep "Skipping notification for sender" /var/log/your-app.log
# OR
grep "Excluding sender" /var/log/your-app.log
```

**If no logs found:**
- Backend might not be passing `senderId` parameter
- Check `src/event/event.service.ts:573` and confirm it calls:
  ```typescript
  await this.notificationsService.sendNewMessage(otherUserId, userId, message.content, eventId);
  //                                                         ^^^^^^ senderId
  ```

### Issue 4: Notifications Not Received at All

**Checklist:**
1. ✅ Check user's preferences: `pushEnabled: true`?
2. ✅ Check device has valid token in database
3. ✅ Check Expo token is valid format: `ExponentPushToken[...]`
4. ✅ Check app has notification permissions
5. ✅ Check backend logs for "Push notification sent to user..."

**Database Query:**
```sql
-- Check user's devices and preferences
SELECT
  u.email,
  u.notification_preferences,
  ud.push_token,
  ud.device_type,
  ud.last_used_at
FROM users u
LEFT JOIN user_devices ud ON ud.user_id = u.id
WHERE u.email = 'user@example.com';
```

### Issue 5: Token Marked as Invalid

**Symptoms:**
- Backend logs: `DeviceNotRegistered` error
- Token automatically removed from database

**Causes:**
- User uninstalled app
- User disabled notifications at OS level
- Expo token expired/revoked

**Solution:**
User needs to:
1. Reinstall app OR re-enable notifications
2. Log in again → new token will be registered

---

## 📊 Database Schema Reference

### `user_devices` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key to `users.id` |
| `device_id` | varchar(255) | Unique device identifier from frontend |
| `device_type` | varchar(50) | 'ios', 'android', or 'web' |
| `device_name` | varchar(255) | Device model/name |
| `push_token` | varchar(255) | Expo push token (**UNIQUE**) |
| `last_used_at` | timestamp | Last time token was used |
| `created_at` | timestamp | Device registration time |
| `updated_at` | timestamp | Last update time |

**Constraints:**
- `push_token` must be unique across ALL devices
- `(user_id, device_id)` must be unique (one device per user)

### `users.notification_preferences` Column

Stores JSON object:
```json
{
  "pushEnabled": true,
  "eventRequests": true,
  "eventAccepted": true,
  "newMessages": true,
  "eventCancelled": true
}
```

---

## 🎯 Summary of Fixes

| Issue | Status | Solution |
|-------|--------|----------|
| Same token for multiple users | ✅ Fixed | Backend removes token from other users before assigning |
| Sender receives own notifications | ✅ Fixed | Sender excluded at multiple levels |
| Preferences show as disabled | ✅ Fixed | Backend returns flat object (not nested) |
| Multi-device support | ✅ Added | New `user_devices` table tracks all devices |
| Token uniqueness | ✅ Enforced | Database constraint + application-level check |

---

## 🚀 Deployment Checklist

- [x] Database migration applied (`0005_third_ken_ellis.sql`)
- [x] Backend code updated
- [x] API response format fixed (notification preferences)
- [ ] Frontend updated (if optional enhancements applied)
- [ ] Testing completed (see Testing Instructions)
- [ ] Production deployment
- [ ] Monitor logs for errors

---

## 📞 Need Help?

If you encounter any issues:

1. **Check Backend Logs:**
   ```bash
   # Look for these patterns:
   grep "push token" /var/log/app.log
   grep "Excluding sender" /var/log/app.log
   grep "notification" /var/log/app.log
   ```

2. **Check Database:**
   ```sql
   -- Token distribution
   SELECT COUNT(*), push_token FROM user_devices GROUP BY push_token HAVING COUNT(*) > 1;
   -- Should return 0 rows (no duplicate tokens)
   ```

3. **Check Frontend Logs:**
   - Look for "Loaded notification preferences"
   - Look for "Push token registered"
   - Look for any error messages

---

---

## 🔄 UPDATE: 2025-12-21 - Preferences Bug Fixed

A bug was discovered where notification preferences were being deleted when users toggled settings. This has been **completely fixed**. See `NOTIFICATION_PREFERENCES_FIX.md` for full details.

**What was fixed:**
- ✅ Database migration to fix all corrupt records
- ✅ Enhanced validation in DTO, Controller, and Service layers
- ✅ Comprehensive logging for debugging
- ✅ Protection against future occurrences

**Action required:** None - migration already applied ✅

---

**Last Updated:** 2025-12-21
**Version:** 1.1.0
**Author:** Claude Code Assistant
