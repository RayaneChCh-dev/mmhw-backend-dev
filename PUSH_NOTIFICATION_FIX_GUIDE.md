# Push Notification & Multi-Account Login Fix

## Problem

When logging out of Account A and logging into Account B on the same device, you get:
```
FIS_AUTH_ERROR: java.util.concurrent.ExecutionException: java.io.IOException: FIS_AUTH_ERROR
```

## Root Cause

1. **Push tokens are tied to app installation, not user accounts**
2. Firebase gives the **same push token** to the same app on the same device
3. Without proper logout handling, Account A's push token remains in the database
4. When Account B logs in with the same token, Account A receives Account B's notifications

## Solution Overview

### Backend Changes (✅ Already Implemented)

Added three new endpoints:
- `POST /auth/register-device` - Register push token for current user
- `POST /auth/logout` - Properly logout and remove push token
- `GET /auth/devices` - Get all user's registered devices

### Frontend Implementation Required

---

## 1. Frontend: Get Device ID

Create a utility to get a unique device ID:

```typescript
// utils/deviceUtils.ts
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export const getDeviceId = async (): Promise<string> => {
  try {
    if (Platform.OS === 'ios') {
      // For iOS, use identifierForVendor
      const iosId = await Application.getIosIdForVendorAsync();
      return iosId || `ios-${Date.now()}`;
    } else if (Platform.OS === 'android') {
      // For Android, use Android ID
      return Application.androidId || `android-${Date.now()}`;
    } else {
      // For web/other platforms
      return `web-${Date.now()}`;
    }
  } catch (error) {
    console.error('Error getting device ID:', error);
    return `fallback-${Date.now()}-${Math.random()}`;
  }
};

export const getDeviceInfo = () => {
  return {
    deviceType: Platform.OS, // 'ios', 'android', 'web'
    deviceName: `${Device.brand} ${Device.modelName}` || Platform.OS,
  };
};
```

---

## 2. Frontend: Register Push Token After Login

Update your login flow to register the device:

```typescript
// services/authService.ts or similar
import * as Notifications from 'expo-notifications';
import { getDeviceId, getDeviceInfo } from '../utils/deviceUtils';
import { api } from './api';

export const registerPushNotifications = async () => {
  try {
    console.log('Attempting to get device push token...');

    // 1. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    // 2. Get push token from Firebase/Expo
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id', // Replace with your project ID
    });

    const pushToken = pushTokenData.data;
    console.log('✅ Got push token:', pushToken.substring(0, 30) + '...');

    // 3. Get device info
    const deviceId = await getDeviceId();
    const { deviceType, deviceName } = getDeviceInfo();

    // 4. Register device with backend
    console.log('Registering device with backend...');
    const response = await api.post('/auth/register-device', {
      deviceId,
      pushToken,
      deviceType,
      deviceName,
    });

    console.log('✅ Device registered successfully');
    return pushToken;

  } catch (error) {
    console.error('❌ Error registering push notifications:', error);

    // Log more details about the error
    if (error.response) {
      console.error('Server response:', error.response.data);
    }

    return null;
  }
};
```

---

## 3. Frontend: Call After Login

Integrate into your login flow:

```typescript
// screens/LoginScreen.tsx or auth context
import { registerPushNotifications } from '../services/authService';

const handleLogin = async (email: string, password: string) => {
  try {
    // 1. Login to get access token
    const response = await api.post('/auth/signin', { email, password });
    const { accessToken, refreshToken, user } = response.data;

    // 2. Save tokens
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);

    // 3. IMPORTANT: Register push notifications AFTER login
    await registerPushNotifications();

    // 4. Navigate to home
    navigation.navigate('Home');

  } catch (error) {
    console.error('Login error:', error);
    // Handle error...
  }
};
```

---

## 4. Frontend: Proper Logout Flow

**THIS IS THE KEY FIX** - Properly clear push token on logout:

```typescript
// services/authService.ts
import { getDeviceId } from '../utils/deviceUtils';
import { api } from './api';

export const logout = async () => {
  try {
    const deviceId = await getDeviceId();

    console.log('Logging out from device:', deviceId);

    // 1. Call backend logout to remove push token
    await api.post('/auth/logout', {
      deviceId,
    });

    console.log('✅ Push token removed from backend');

    // 2. Clear local storage
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');

    // 3. IMPORTANT: Clear any cached Firebase/notification state
    // This helps prevent FIS_AUTH_ERROR
    try {
      // Attempt to unregister from notifications
      await Notifications.unregisterForNotificationsAsync();
      console.log('✅ Unregistered from notifications');
    } catch (error) {
      console.warn('Could not unregister from notifications:', error);
    }

    console.log('✅ Logout complete');

  } catch (error) {
    console.error('❌ Logout error:', error);

    // Even if backend call fails, clear local storage
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
  }
};
```

---

## 5. Frontend: Handle FIS_AUTH_ERROR

Add retry logic with exponential backoff:

```typescript
// services/authService.ts
export const registerPushNotifications = async (retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${retries}] Getting push token...`);

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }

      // Get push token
      const pushTokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id',
      });

      const pushToken = pushTokenData.data;
      console.log('✅ Got push token');

      // Get device info
      const deviceId = await getDeviceId();
      const { deviceType, deviceName } = getDeviceInfo();

      // Register with backend
      await api.post('/auth/register-device', {
        deviceId,
        pushToken,
        deviceType,
        deviceName,
      });

      console.log('✅ Device registered successfully');
      return pushToken;

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      // Check if it's FIS_AUTH_ERROR
      if (error.message?.includes('FIS_AUTH_ERROR')) {
        if (attempt < retries) {
          // Wait before retrying (exponential backoff)
          const waitTime = delay * Math.pow(2, attempt - 1);
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry
        } else {
          console.error('❌ All retry attempts failed');
          // Show user-friendly error
          Alert.alert(
            'Notification Setup Failed',
            'Could not set up push notifications. Please try logging in again or restart the app.',
            [{ text: 'OK' }]
          );
        }
      }

      return null;
    }
  }

  return null;
};
```

---

## 6. Complete Login/Logout Flow

### Login Flow:
```
1. User enters credentials
2. Call POST /auth/signin
3. Receive access token
4. Save tokens to AsyncStorage
5. Call registerPushNotifications()
   ├─ Get device ID
   ├─ Get push token from Firebase
   └─ POST /auth/register-device
6. Navigate to home
```

### Logout Flow:
```
1. User clicks logout
2. Get device ID
3. Call POST /auth/logout { deviceId }
4. Backend removes push token from database
5. Clear AsyncStorage
6. Unregister from notifications
7. Navigate to login screen
```

### Switching Accounts:
```
1. User logs out of Account A
   └─ POST /auth/logout removes Account A's device
2. User logs into Account B
   └─ POST /auth/register-device claims the push token for Account B
3. ✅ Only Account B receives notifications now
```

---

## 7. Testing Checklist

### Test Account Switching:
- [ ] Login with Account A
- [ ] Verify you can receive notifications
- [ ] Logout from Account A
- [ ] Login with Account B on **same device**
- [ ] Verify Account B receives notifications
- [ ] Verify Account A does NOT receive notifications

### Test FIS_AUTH_ERROR Fix:
- [ ] Login with Account A
- [ ] Logout
- [ ] **Wait 30 seconds**
- [ ] Login with Account B
- [ ] Should NOT see `FIS_AUTH_ERROR`
- [ ] Should successfully get push token

### Test Multiple Devices:
- [ ] Login on Device 1
- [ ] Login on Device 2 with same account
- [ ] Both devices should receive notifications
- [ ] Logout from Device 1
- [ ] Only Device 2 receives notifications now

---

## 8. Environment Setup

Make sure you have these packages:

```bash
expo install expo-notifications expo-device expo-application
```

Update `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#ffffff",
      "androidMode": "default",
      "androidCollapsedTitle": "#{unread_notifications} new notifications"
    }
  }
}
```

---

## 9. Common Issues & Solutions

### Issue 1: Still getting FIS_AUTH_ERROR

**Solution:**
1. Add delay between logout and login (2-3 seconds)
2. Clear app cache/data
3. Restart the app completely
4. Use retry logic with exponential backoff

### Issue 2: Push token is null after login

**Solution:**
1. Check notification permissions
2. Verify Firebase configuration
3. Check network connection
4. Look for error logs in console

### Issue 3: Previous user still receives notifications

**Solution:**
1. Verify logout endpoint is being called
2. Check backend logs to confirm device removal
3. Ensure frontend is calling `/auth/register-device` after each login

---

## 10. Backend API Reference

### Register Device
```
POST /auth/register-device
Authorization: Bearer <access_token>

Body:
{
  "deviceId": "unique-device-id",
  "pushToken": "ExponentPushToken[...]",
  "deviceType": "ios" | "android" | "web",
  "deviceName": "iPhone 13 Pro"
}

Response:
{
  "message": "Device registered successfully"
}
```

### Logout
```
POST /auth/logout
Authorization: Bearer <access_token>

Body:
{
  "deviceId": "unique-device-id"
}

Response:
{
  "message": "Logged out successfully"
}
```

### Get User Devices
```
GET /auth/devices
Authorization: Bearer <access_token>

Response:
[
  {
    "id": "uuid",
    "userId": "uuid",
    "deviceId": "unique-device-id",
    "pushToken": "ExponentPushToken[...]",
    "deviceType": "ios",
    "deviceName": "iPhone 13 Pro",
    "lastUsedAt": "2026-01-03T00:00:00Z",
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

---

## Summary

✅ **Backend:** Already implemented device management and push token reassignment
⚠️ **Frontend:** You need to:
1. Get device ID using `expo-device` and `expo-application`
2. Call `/auth/register-device` after every login
3. Call `/auth/logout` before clearing local storage
4. Add retry logic for `FIS_AUTH_ERROR`

This will completely fix the multi-account login and push notification issues.
