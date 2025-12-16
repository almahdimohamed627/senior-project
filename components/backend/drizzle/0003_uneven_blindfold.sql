

-- Ensure enum types exist before tables that use them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_conversation_status') THEN
    CREATE TYPE "ai_conversation_status" AS ENUM ('in_progress', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_message_role') THEN
    CREATE TYPE "ai_message_role" AS ENUM ('human', 'ai');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE "message_type" AS ENUM ('text', 'audio');
  END IF;

  -- These two are referenced in your SQL too:
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
    CREATE TYPE "status" AS ENUM ('pending', 'accepted', 'rejected'); -- عدّل القيم حسب تعريفك الحقيقي
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE "role" AS ENUM ('patient', 'doctor', 'admin'); -- حسب enum Role عندك
  END IF;
END$$;

CREATE TABLE "conversation_ai" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"diagnosis" text,
	"status" "ai_conversation_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"doctor_id" varchar(255) NOT NULL,
	"patient_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fusion_auth_id" varchar(255) NOT NULL,
	"university" varchar(255) NOT NULL,
	"specialty" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "doctor_profiles_fusion_auth_id_unique" UNIQUE("fusion_auth_id")
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
CREATE TABLE "patient_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fusion_auth_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "patient_profiles_fusion_auth_id_unique" UNIQUE("fusion_auth_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"user_id" varchar NOT NULL,
	"photos" text,
	"number_of_likes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"fusion_auth_id" varchar(255) NOT NULL,
	"firstName" varchar,
	"lastName" varchar,
	"email" varchar,
	"gender" varchar(20) NOT NULL,
	"profile_photo" text,
	"city" varchar(100) NOT NULL,
	"birth_year" integer NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"role" "role",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_fusion_auth_id_unique" UNIQUE("fusion_auth_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_ai" ADD CONSTRAINT "conversation_ai_user_id_users_fusion_auth_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_ai_messages" ADD CONSTRAINT "conversation_ai_messages_conversation_id_conversation_ai_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation_ai"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_doctor_id_users_fusion_auth_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_id_users_fusion_auth_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_fusion_auth_id_users_fusion_auth_id_fk" FOREIGN KEY ("fusion_auth_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_fusion_auth_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_fusion_auth_id_users_fusion_auth_id_fk" FOREIGN KEY ("fusion_auth_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_doctor_profiles_fusion_auth_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."doctor_profiles"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_sender_id_users_fusion_auth_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_receiver_id_users_fusion_auth_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;