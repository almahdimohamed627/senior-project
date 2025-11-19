CREATE TYPE "public"."role" AS ENUM('admine', 'doctor', 'patient');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"fusion_auth_id" varchar(255) NOT NULL,
	"firstName" varchar,
	"lastName" varchar,
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
ALTER TABLE "dataset_images" ALTER COLUMN "label" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "senderId" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "receiverId" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_senderId_doctor_profiles_fusion_auth_id_fk" FOREIGN KEY ("senderId") REFERENCES "public"."doctor_profiles"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_receiverId_patient_profiles_fusion_auth_id_fk" FOREIGN KEY ("receiverId") REFERENCES "public"."patient_profiles"("fusion_auth_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_profiles" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "doctor_profiles" DROP COLUMN "profile_photo";--> statement-breakpoint
ALTER TABLE "doctor_profiles" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "doctor_profiles" DROP COLUMN "birth_year";--> statement-breakpoint
ALTER TABLE "doctor_profiles" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "patient_profiles" DROP COLUMN "birth_year";--> statement-breakpoint
ALTER TABLE "patient_profiles" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "patient_profiles" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "patient_profiles" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "patient_profiles" DROP COLUMN "profile_photo";