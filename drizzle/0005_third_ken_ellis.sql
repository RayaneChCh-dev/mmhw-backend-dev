CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"device_type" varchar(50),
	"device_name" varchar(255),
	"push_token" varchar(255) NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_devices_push_token_unique" UNIQUE("push_token")
);
--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_device" ON "user_devices" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_push_token" ON "user_devices" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "idx_user_devices_user" ON "user_devices" USING btree ("user_id");