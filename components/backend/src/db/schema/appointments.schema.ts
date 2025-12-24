import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { doctorProfile } from "./profiles.schema";

export const appointments = pgTable('appointments', {
  id: serial("id").primaryKey().notNull(),

  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctorProfile.fusionAuthId, { onDelete: "cascade" }),

  dayOfWeek: integer("day_of_week").notNull(), 
  // 0 = Sunday, 1 = Monday, ... 6 = Saturday

  startTime: text("start_time").notNull(), // "10:00"
  endTime: text("end_time").notNull(),   // "14:00"

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});