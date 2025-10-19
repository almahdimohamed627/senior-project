// src/db/schema/profiles.ts
import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

// Doctor table
export const doctorProfile = pgTable('doctor_profiles', {
  id: serial('id').primaryKey(),
  fusionAuthId: varchar('fusion_auth_id', { length: 255 }).notNull().unique(),
  gender: varchar('gender', { length: 20 }).notNull(),
  university: varchar('university', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 255 }).notNull(),
  profilePhoto: text('profile_photo'),
  city: varchar('city', { length: 100 }).notNull(),
  birthYear: integer('birth_year').notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Patient table
export const patientProfile = pgTable('patient_profiles', {
  id: serial('id').primaryKey(),
  fusionAuthId: varchar('fusion_auth_id', { length: 255 }).notNull().unique(),
  birthYear: integer('birth_year').notNull(),
  gender: varchar('gender', { length: 20 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  profilePhoto: text('profile_photo'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type DoctorProfile = typeof doctorProfile.$inferSelect;
export type NewDoctorProfile = typeof doctorProfile.$inferInsert;
export type PatientProfile = typeof patientProfile.$inferSelect;
export type NewPatientProfile = typeof patientProfile.$inferInsert;
