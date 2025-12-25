CREATE TYPE "public"."check_in_status" AS ENUM('pending', 'checked_in', 'no_show');--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'scheduled'::text;--> statement-breakpoint
DROP TYPE "public"."event_status";--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'matched', 'revalidation_pending', 'active', 'on_site_partial', 'on_site_confirmed', 'completed', 'cancelled', 'cancelled_no_revalidation', 'cancelled_geo_mismatch', 'expired');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"public"."event_status";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DATA TYPE "public"."event_status" USING "status"::"public"."event_status";--> statement-breakpoint
-- Handle existing events: set scheduled_start_time to created_at + 2 hours, duration to 120 minutes
ALTER TABLE "events" ADD COLUMN "scheduled_start_time" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "duration" integer;--> statement-breakpoint
UPDATE "events" SET "scheduled_start_time" = "created_at" + interval '2 hours' WHERE "scheduled_start_time" IS NULL;--> statement-breakpoint
UPDATE "events" SET "duration" = 120 WHERE "duration" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "scheduled_start_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "duration" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "revalidation_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "revalidation_responded_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "revalidation_confirmed" boolean;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "revalidation_location" json;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "creator_check_in_status" "check_in_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "participant_check_in_status" "check_in_status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "creator_check_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "participant_check_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "creator_check_in_location" json;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "participant_check_in_location" json;--> statement-breakpoint
CREATE INDEX "idx_events_scheduled_start" ON "events" USING btree ("scheduled_start_time");