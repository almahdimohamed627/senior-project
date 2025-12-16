import { pgTable, serial, varchar, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { doctorProfile, patientProfile, users } from './profiles.schema';

export const status = pgEnum('status', ['pending', 'accepted', 'rejected']);
export const requests = pgTable('requests', {
  id: serial('id').primaryKey(),

  senderId: text("sender_id")
    .notNull()
    .references(() => users.fusionAuthId,{onDelete:"cascade"}),

  receiverId: text("receiver_id")
    .notNull()
    .references(() => users.fusionAuthId,{onDelete:"cascade"}),

  status: status("status")
    .notNull()
    .default('pending'),

  createdAt: timestamp('created_at')
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow(),
});