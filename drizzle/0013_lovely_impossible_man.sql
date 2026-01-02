CREATE TYPE "public"."event_type" AS ENUM('immediate', 'scheduled');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "scheduled_start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "duration" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type" "event_type" DEFAULT 'scheduled' NOT NULL;