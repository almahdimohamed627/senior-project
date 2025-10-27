// src/db/schema/dataset_images.schema.ts
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const datasetImages = pgTable("dataset_images", {
  id: serial("id").primaryKey().notNull(),
  uploaderId: text("uploader_id").notNull(), // can be username or id - simple
  // filenames for the 4 images (stored relative to uploads/)
  upperJawFile: text("upper_jaw_file").notNull(),
  lowerJawFile: text("lower_jaw_file").notNull(),
  fullMouthFile: text("full_mouth_file").notNull(),
  smileFile: text("smile_file").notNull(),
  gum:boolean('gum'),
  caries:boolean('caries'),
  surgery:boolean('surgery'),
  fixed:boolean('fixed'),
  animated:boolean('animated'),

  // label / diagnosis (free text or enum)
  label: text("label"),

  // optional additional notes / metadata as JSON string
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
