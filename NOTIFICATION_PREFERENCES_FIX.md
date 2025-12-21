# Notification Preferences Bug Fix - Complete Summary

**Date:** 2025-12-21
**Issue:** Notification preferences being deleted when users toggle settings
**Status:** ✅ FIXED

---

## 🐛 Root Cause

The backend code was **already correct** (merging partial updates properly), but the database contained **corrupt records** from a previous version of the code that was replacing entire objects instead of merging.

**Example of corrupt data:**
- User toggles "Message Notifications" off
- Old buggy backend replaced: `{"pushEnabled":true,"eventRequests":true,...}` → `{"newMessages":false}`
- Result: 4 out of 5 fields were deleted ❌

---

## ✅ What Was Fixed

### 1. **Database Migration** (Drizzle)
**File:** `drizzle/0006_fix_notification_preferences.sql`

- Finds all users with null or incomplete `notification_preferences`
- Merges existing values with defaults (all fields default to `true`)
- Ensures all 5 required fields are present: `pushEnabled`, `eventRequests`, `eventAccepted`, `newMessages`, `eventCancelled`

**Status:** ✅ Migration successfully applied

### 2. **Enhanced DTO Validation**
**File:** `src/notifications/dto/notification-preferences.dto.ts`

**Changes:**
- Added custom error messages for each boolean field
- Added documentation explaining partial updates
- Marked all fields as `required: false` in Swagger
- Removed unused `ValidateIf` import

**Benefits:**
- Better error messages for invalid input
- Clear API documentation
- Type safety maintained

### 3. **Controller Validation**
**File:** `src/notifications/notifications.controller.ts`

**Changes:**
- Added `ValidationPipe` with strict options:
  - `whitelist: true` - Strips unknown properties
  - `forbidNonWhitelisted: true` - Throws error for unknown properties
  - `transform: true` - Transforms payloads to DTO instances
- Added check to ensure at least one field is provided
- Added error response documentation

**Benefits:**
- Prevents malicious/invalid fields from being sent
- Clear error messages for empty requests
- Better API security

### 4. **Service Layer Validation**
**File:** `src/notifications/notifications.service.ts` (lines 406-474)

**Changes:**
- Added validation to ensure at least one field is provided
- Added detailed debug logging for update requests
- Added validation after merge to ensure all 5 required fields exist
- Enhanced error messages with specific field names
- Added success logging with full preference object

**Benefits:**
- Catches edge cases that might slip through
- Better debugging capabilities
- Prevents invalid data from being saved
- Clear audit trail in logs

---

## 🧪 How to Test

### Test 1: Verify Database Fix
```sql
-- All users should have complete preferences now
SELECT
  id,
  email,
  notification_preferences
FROM users
WHERE notification_preferences IS NOT NULL
LIMIT 10;

-- This should return 0 rows (no incomplete records)
SELECT COUNT(*)
FROM users
WHERE
  notification_preferences IS NULL
  OR NOT (
    notification_preferences ? 'pushEnabled' AND
    notification_preferences ? 'eventRequests' AND
    notification_preferences ? 'eventAccepted' AND
    notification_preferences ? 'newMessages' AND
    notification_preferences ? 'eventCancelled'
  );
```

### Test 2: Frontend Integration
1. Open Settings page on your Expo app
2. **Expected:** All toggles should reflect correct state (not all OFF)
3. Toggle "Message Notifications" OFF
4. Refresh the page
5. **Expected:** Only "Message Notifications" is OFF, all others remain ON

### Test 3: API Testing
```bash
# Get preferences
curl -H "Authorization: Bearer <token>" \
  https://your-api.com/notifications/preferences

# Expected response:
{
  "pushEnabled": true,
  "eventRequests": true,
  "eventAccepted": true,
  "newMessages": true,
  "eventCancelled": true
}

# Update one preference
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"newMessages": false}' \
  https://your-api.com/notifications/preferences

# Get preferences again - should show newMessages: false, others: true
```

### Test 4: Validation Testing
```bash
# Test invalid type (should fail)
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"newMessages": "invalid"}' \
  https://your-api.com/notifications/preferences
# Expected: 400 Bad Request with validation error

# Test unknown field (should fail)
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"unknownField": true}' \
  https://your-api.com/notifications/preferences
# Expected: 400 Bad Request - property not whitelisted

# Test empty object (should fail)
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://your-api.com/notifications/preferences
# Expected: 400 Bad Request - at least one field required
```

---

## 🔒 Protection Against Future Bugs

### 1. **Database Level**
- Migration ensures all existing records are complete
- New records will always get defaults from `getNotificationPreferences()`

### 2. **Application Level**
- Service layer **always merges** partial updates with existing values
- Validation ensures merged result has all 5 required fields
- If validation fails, transaction rolls back (no corrupt data saved)

### 3. **API Level**
- DTOs validate each field is a boolean
- Controller rejects unknown fields
- Controller requires at least one field in request

### 4. **Logging Level**
- All updates are logged with before/after values
- Easy to debug if issues occur again
- Can track which users/fields are being updated

---

## 📊 Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `drizzle/0006_fix_notification_preferences.sql` | **NEW** | Migration to fix corrupt records |
| `drizzle/meta/_journal.json` | **MODIFIED** | Added migration to journal |
| `drizzle/meta/0006_snapshot.json` | **NEW** | Snapshot for migration |
| `src/notifications/dto/notification-preferences.dto.ts` | **ENHANCED** | Added validation messages and docs |
| `src/notifications/notifications.controller.ts` | **ENHANCED** | Added ValidationPipe and checks |
| `src/notifications/notifications.service.ts` | **ENHANCED** | Added comprehensive validation and logging |

---

## 🚀 Deployment Checklist

- [x] Database migration created
- [x] Migration successfully applied to database
- [x] DTO validation enhanced
- [x] Controller validation added
- [x] Service layer validation enhanced
- [ ] Test on staging environment
- [ ] Test from frontend app
- [ ] Monitor logs for any errors
- [ ] Deploy to production
- [ ] Verify with real users

---

## 🎯 What to Monitor

After deployment, check these logs:

### Success Logs (Expected)
```
DEBUG Updating notification preferences for user <uuid>: {"newMessages":false}
DEBUG Notification preferences successfully updated for user <uuid>: {"pushEnabled":true,"eventRequests":true,"eventAccepted":true,"newMessages":false,"eventCancelled":true}
```

### Error Logs (Should NOT see these)
```
ERROR Missing required fields after merge: ...
ERROR Failed to merge preferences - missing required fields
```

If you see error logs, it means:
1. A new edge case was discovered
2. The validation is working correctly (preventing bad data)
3. You should investigate the request that triggered it

---

## 📝 Frontend Update

Your frontend code (`settings.tsx`) is **already correct** ✅

The frontend properly sends partial updates like:
- `{ pushEnabled: false }`
- `{ newMessages: true }`
- `{ eventRequests: true, eventAccepted: true, eventCancelled: true }`

The backend now correctly merges these with existing preferences.

**No frontend changes needed!**

---

## 💡 Key Takeaways

1. **Always merge partial updates** - Never replace entire objects in JSON columns
2. **Validate after merge** - Ensure required fields exist after merging
3. **Use migrations to fix data** - Don't rely only on code fixes
4. **Add comprehensive logging** - Makes debugging 10x easier
5. **Test with edge cases** - Empty objects, invalid types, unknown fields

---

## ✅ Next Steps

1. **Test thoroughly** - Use the test cases above
2. **Monitor logs** - Check for any unexpected errors
3. **Update NOTIFICATION_SYSTEM_UPDATE.md** - Document this fix
4. **Deploy to production** - When ready

---

**Questions or Issues?**
If you encounter any problems, check:
1. Backend logs for validation errors
2. Database for incomplete preferences (should be none)
3. Frontend console for API errors
4. Network tab for request/response details

All validation is now in place to prevent this bug from happening again! 🎉
