import { integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { serial,pgTable } from "drizzle-orm/pg-core";
import { doctorProfile, patientProfile, users } from "./profiles.schema";
import { pgEnum } from "drizzle-orm/pg-core";
import { requests } from "./request.schema";
import { stringify } from "querystring";
import { boolean } from "drizzle-orm/pg-core";


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
export const aiConversationStatus = pgEnum('ai_conversation_status', [
  'in_progress',
  'specified',
  'completed'

]);

export const messageType = pgEnum('message_type', ['text', 'audio','image' ]);

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),

  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),

  senderId: varchar('sender_id', { length: 255 })
    .notNull()
    .references(() => users.fusionAuthId),

  type: messageType('type').notNull().default('text'),

  text: text('text'), 
  audioUrl: text('audio_url'), 
  imageUrl:text('image_url'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});




export const specialtyEnumE = pgEnum('specialtyE', [
  'Restorative',
  'Endodontics',
  'Periodontics',
  'Fixed_prosthodontics',
  'Removable_prosthodontics',
  'Pediatric_dentistry',
]);
export const specialtyEnumA = pgEnum('specialtyA', [
  'Restorative',
  'Endodontics',
  'Periodentics',
  'Fixed_Prosthondontics',
  'Removable_Prosthondontics',
  'Pediatric_Dentistry',
]);

export const conversationAI = pgTable('conversation_ai', {
  id: serial('id').primaryKey(),


  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.fusionAuthId,{onDelete:"cascade"}),

  doctorId:varchar('doctorId').references(()=>doctorProfile.fusionAuthId,{onDelete:'cascade'}),
  specialityE: specialtyEnumE('specialityE'),
  specialityA: specialtyEnumA('specialityA'),
  image_path:text('image_path'),

  status: aiConversationStatus('status')
    .notNull()
    .default('in_progress'),
    is_final:boolean('is_final').default(false),
   pdfReportPath: varchar('pdf_report_path'),
   qrCodePath: varchar('qr_code_path'),

  
  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow(),
});
export const conversationAiMessages = pgTable('conversation_ai_messages', {
  id: serial('id').primaryKey(),

  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversationAI.id, { onDelete: 'cascade' }),


  msg: text('msg').notNull(),
  ai_response: text('ai_response'),
 


  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),
});

  


