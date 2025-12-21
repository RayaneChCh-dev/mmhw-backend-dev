-- Migration: Fix incomplete notification_preferences in users table
-- This ensures all users have complete preference objects with all 5 required fields
-- Created: 2025-12-21

-- Fix all users with null or incomplete notification_preferences
UPDATE "users"
SET "notification_preferences" = jsonb_build_object(
  'pushEnabled', COALESCE(("notification_preferences"->>'pushEnabled')::boolean, true),
  'eventRequests', COALESCE(("notification_preferences"->>'eventRequests')::boolean, true),
  'eventAccepted', COALESCE(("notification_preferences"->>'eventAccepted')::boolean, true),
  'newMessages', COALESCE(("notification_preferences"->>'newMessages')::boolean, true),
  'eventCancelled', COALESCE(("notification_preferences"->>'eventCancelled')::boolean, true)
)
WHERE
  "notification_preferences" IS NULL
  OR NOT (
    "notification_preferences" ? 'pushEnabled' AND
    "notification_preferences" ? 'eventRequests' AND
    "notification_preferences" ? 'eventAccepted' AND
    "notification_preferences" ? 'newMessages' AND
    "notification_preferences" ? 'eventCancelled'
  );
