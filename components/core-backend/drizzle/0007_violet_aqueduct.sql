ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'doctor', 'patient');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_fusion_auth_id_users_fusion_auth_id_fk" FOREIGN KEY ("fusion_auth_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_fusion_auth_id_users_fusion_auth_id_fk" FOREIGN KEY ("fusion_auth_id") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;