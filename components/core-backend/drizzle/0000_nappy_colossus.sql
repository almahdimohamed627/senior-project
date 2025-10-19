CREATE TABLE "doctor_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fusion_auth_id" varchar(255) NOT NULL,
	"gender" varchar(20) NOT NULL,
	"university" varchar(255) NOT NULL,
	"specialty" varchar(255) NOT NULL,
	"profile_photo" text,
	"city" varchar(100) NOT NULL,
	"birth_year" integer NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "doctor_profiles_fusion_auth_id_unique" UNIQUE("fusion_auth_id")
);
--> statement-breakpoint
CREATE TABLE "patient_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"fusion_auth_id" varchar(255) NOT NULL,
	"birth_year" integer NOT NULL,
	"gender" varchar(20) NOT NULL,
	"city" varchar(100) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"profile_photo" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "patient_profiles_fusion_auth_id_unique" UNIQUE("fusion_auth_id")
);
