-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_profiles_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "chatrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_private" boolean DEFAULT false,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chatroom_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatroom_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chatroom_members_chatroom_id_user_id_key" UNIQUE("chatroom_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatroom_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'mention' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"read" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "chatrooms" ADD CONSTRAINT "chatrooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatroom_members" ADD CONSTRAINT "chatroom_members_chatroom_id_fkey" FOREIGN KEY ("chatroom_id") REFERENCES "public"."chatrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatroom_members" ADD CONSTRAINT "chatroom_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_profiles_username" ON "user_profiles" USING btree ("username" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chatrooms_created_by" ON "chatrooms" USING btree ("created_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chatroom_members_chatroom" ON "chatroom_members" USING btree ("chatroom_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_chatroom_members_user" ON "chatroom_members" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_chatroom" ON "chat_messages" USING btree ("chatroom_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_chat_messages_created_at" ON "chat_messages" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("user_id" text_ops,"read" text_ops);--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id" text_ops);
*/