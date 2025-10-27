// src/db/schema/posts.ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm"; // قد تحتاجه لاحقًا للـ default expressions
import { doctorProfile, patientProfile, DoctorProfile, PatientProfile, NewDoctorProfile, NewPatientProfile } from "./profiles.schema";
import { relations } from "drizzle-orm";

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),

  title: text('title').notNull(),
  content: text('content').notNull(),

  // FusionAuth IDs غالباً تكون نصية (UUID أو string) -> استخدم text هنا
  userId: text('user_id')
    .notNull()
    .references(() => doctorProfile.fusionAuthId, { onDelete: 'cascade' }),

  // photos: خزن مصفوفة روابط الصور كـ jsonb
  // ملاحظة: Drizzle لا يملك helper ثابت لكل نسخة لاسم 'jsonb' لذا نستخدم text عمود ونخزن JSON،
  // أو إذا أردت jsonb حقيقي فاستبدل text بـ sql`jsonb` أو استخدم helper المناسب لإصدارك.
  photos: text('photos'), // تخزن JSON stringified array: e.g. '["https://...", "..."]'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const postsRelations =relations(posts,({one})=>({
  doctor:one(doctorProfile,{
    fields:[posts.userId],
    references:[doctorProfile.fusionAuthId]
  })
}))

export default {
    posts,
    postsRelations
}
