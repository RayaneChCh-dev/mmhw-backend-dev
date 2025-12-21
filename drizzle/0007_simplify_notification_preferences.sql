-- Migration: Simplify notification_preferences to only use pushEnabled
-- Remove eventRequests, eventAccepted, newMessages, eventCancelled fields
-- Keep only pushEnabled as master toggle for all notifications
-- Created: 2025-12-21

-- Simplify all notification preferences to only have pushEnabled
-- If any notification type was true, set pushEnabled to true
-- If all were false, set pushEnabled to false
UPDATE "users"
SET "notification_preferences" = jsonb_build_object(
  'pushEnabled', COALESCE(
    (
      COALESCE(("notification_preferences"->>'pushEnabled')::boolean, true) OR
      COALESCE(("notification_preferences"->>'eventRequests')::boolean, false) OR
      COALESCE(("notification_preferences"->>'eventAccepted')::boolean, false) OR
      COALESCE(("notification_preferences"->>'newMessages')::boolean, false) OR
      COALESCE(("notification_preferences"->>'eventCancelled')::boolean, false)
    ),
    true
  )
)
WHERE "notification_preferences" IS NOT NULL;

-- Set default for users with null preferences
UPDATE "users"
SET "notification_preferences" = jsonb_build_object('pushEnabled', true)
WHERE "notification_preferences" IS NULL;
