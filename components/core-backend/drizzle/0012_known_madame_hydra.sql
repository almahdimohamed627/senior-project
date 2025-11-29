CREATE TYPE "public"."message_type" AS ENUM('text', 'audio');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"doctor_id" varchar(255) NOT NULL,
	"patient_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"text" text,
	"audio_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_senderId_doctor_profiles_fusion_auth_id_fk";
--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_receiverId_patient_profiles_fusion_auth_id_fk";
--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."status";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "status" SET DATA TYPE "public"."status" USING "status"::"public"."status";--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "sender_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "receiver_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_doctor_id_users_fusion_auth_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_id_users_fusion_auth_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_fusion_auth_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_sender_id_users_fusion_auth_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_receiver_id_users_fusion_auth_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "is";--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "senderId";--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "receiverId";