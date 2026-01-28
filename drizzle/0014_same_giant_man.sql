CREATE TYPE "public"."bug_report_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."bug_report_status" AS ENUM('pending', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255),
	"description" text NOT NULL,
	"status" "bug_report_status" DEFAULT 'pending' NOT NULL,
	"priority" "bug_report_priority" DEFAULT 'medium' NOT NULL,
	"device_info" json,
	"admin_notes" text,
	"resolved_by" uuid,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bug_reports_user" ON "bug_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bug_reports_status" ON "bug_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bug_reports_priority" ON "bug_reports" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_bug_reports_created" ON "bug_reports" USING btree ("created_at");