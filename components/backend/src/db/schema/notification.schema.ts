import { boolean, jsonb, pgTable ,serial, text, timestamp, varchar} from "drizzle-orm/pg-core";
import { users } from "./profiles.schema";



export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => users.fusionAuthId),

  title: text('title').notNull(),
  body: text('body').notNull(),
  

  type: varchar('type', { length: 50 }).notNull(), 
  
  isRead: boolean('is_read').default(false),
  
  metadata: jsonb('metadata'), 

  createdAt: timestamp('created_at').defaultNow(),
});