CREATE TABLE "likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"liked_py" varchar(255) NOT NULL,
	CONSTRAINT "likes_post_id_liked_py_pk" PRIMARY KEY("post_id","liked_py")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "number_of_likes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_liked_py_users_fusion_auth_id_fk" FOREIGN KEY ("liked_py") REFERENCES "public"."users"("fusion_auth_id") ON DELETE cascade ON UPDATE no action;