-- Update existing users who have NULL notification_preferences
UPDATE "users"
SET "notification_preferences" = '{"pushEnabled":true,"eventRequests":true,"eventAccepted":true,"newMessages":true,"eventCancelled":true}'::json
WHERE "notification_preferences" IS NULL;
