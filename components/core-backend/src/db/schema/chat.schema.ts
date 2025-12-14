import { integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { serial,pgTable } from "drizzle-orm/pg-core";
import { doctorProfile, patientProfile, users } from "./profiles.schema";
import { pgEnum } from "drizzle-orm/pg-core";
import { requests } from "./request.schema";

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),

  requestId: integer('request_id')
    .notNull()
    .references(() => requests.id, { onDelete: 'cascade' }),

  doctorId: varchar('doctor_id', { length: 255 })
    .notNull()
    .references(() => users.fusionAuthId),

  patientId: varchar('patient_id', { length: 255 })
    .notNull()
    .references(() => users.fusionAuthId),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messageType = pgEnum('message_type', ['text', 'audio']);

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),

  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),

  senderId: varchar('sender_id', { length: 255 })
    .notNull()
    .references(() => users.fusionAuthId),

  type: messageType('type').notNull().default('text'),

  text: text('text'), // nullable لو type = audio
  audioUrl: text('audio_url'), // nullable لو type = text

  createdAt: timestamp('created_at').defaultNow().notNull(),
});


