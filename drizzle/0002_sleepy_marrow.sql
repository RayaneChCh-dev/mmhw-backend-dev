CREATE TYPE "public"."event_activity" AS ENUM('coffee', 'cowork', 'meal', 'drinks', 'walk');--> statement-breakpoint
CREATE TYPE "public"."event_request_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('active', 'matched', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."feedback_rating" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TABLE "blocked_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" uuid NOT NULL,
	"user2_id" uuid NOT NULL,
	"last_message_content" text,
	"last_message_at" timestamp,
	"last_message_sender_id" uuid,
	"user1_unread_count" integer DEFAULT 0 NOT NULL,
	"user2_unread_count" integer DEFAULT 0 NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_by" uuid,
	"blocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"creator_message_count" integer DEFAULT 0 NOT NULL,
	"participant_message_count" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "event_chats_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "event_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"rating" "feedback_rating" NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"message_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"status" "event_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"hub_id" varchar(255) NOT NULL,
	"hub_name" varchar(255) NOT NULL,
	"hub_type" varchar(50) NOT NULL,
	"hub_location" json NOT NULL,
	"hub_address" text,
	"activity_type" "event_activity" NOT NULL,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"participant_id" uuid,
	"matched_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"event_id" uuid,
	"reason" varchar(50) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"action_taken" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_meetup_date" timestamp,
	"events_created" integer DEFAULT 0 NOT NULL,
	"events_joined" integer DEFAULT 0 NOT NULL,
	"events_completed" integer DEFAULT 0 NOT NULL,
	"events_cancelled" integer DEFAULT 0 NOT NULL,
	"no_shows" integer DEFAULT 0 NOT NULL,
	"positive_ratings" integer DEFAULT 0 NOT NULL,
	"neutral_ratings" integer DEFAULT 0 NOT NULL,
	"negative_ratings" integer DEFAULT 0 NOT NULL,
	"reports_received" integer DEFAULT 0 NOT NULL,
	"reports_made" integer DEFAULT 0 NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"suspended_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_chats" ADD CONSTRAINT "event_chats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_chat_id_event_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."event_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_block" ON "blocked_users" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_conversation_users" ON "conversations" USING btree (LEAST("user1_id"::text, "user2_id"::text),GREATEST("user1_id"::text, "user2_id"::text));--> statement-breakpoint
CREATE INDEX "idx_conversations_user1" ON "conversations" USING btree ("user1_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user2" ON "conversations" USING btree ("user2_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_last_message" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_event_feedback" ON "event_feedback" USING btree ("event_id","from_user_id");--> statement-breakpoint
CREATE INDEX "idx_event_messages_chat" ON "event_messages" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_event_request" ON "event_requests" USING btree ("event_id","requester_id");--> statement-breakpoint
CREATE INDEX "idx_event_requests_event" ON "event_requests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_requests_requester" ON "event_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_hub_id" ON "events" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_events_creator" ON "events" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "idx_events_expires" ON "events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_unread" ON "messages" USING btree ("conversation_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_reports_reporter" ON "user_reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "idx_reports_reported" ON "user_reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "user_reports" USING btree ("status");