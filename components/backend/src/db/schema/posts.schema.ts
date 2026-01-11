// src/db/schema/posts.ts
import { pgTable, serial, text, timestamp,varchar ,integer,primaryKey} from "drizzle-orm/pg-core";
import { doctorProfile, users } from "./profiles.schema";
import { relations } from "drizzle-orm";
import { pgEnum } from "drizzle-orm/pg-core";

export const reviewStatus=pgEnum('reviewStatus',['published','rejected','in_review'])


export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),

  title: text('title').notNull(),
  content: text('content').notNull(),

  userId: varchar('user_id')
    .notNull()
    .references(() => doctorProfile.fusionAuthId, { onDelete: 'cascade' }),

  photos: text('photos'),
  keyStatus:reviewStatus('keyStatus').default('in_review'),

  numberOfLikes: integer('number_of_likes').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const postsRelations =relations(posts,({one})=>({
  doctor:one(doctorProfile,{
    fields:[posts.userId],
    references:[doctorProfile.fusionAuthId]
  })
}))
export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),

    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),

    likedPy: varchar("liked_py", { length: 255 })
      .notNull()
      .references(() => users.fusionAuthId, { onDelete: "cascade" }),
        createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }

)

export default {
    posts,
    postsRelations,
    likes
}
