CREATE TABLE "dataset_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"uploader_id" text NOT NULL,
	"upper_jaw_file" text NOT NULL,
	"lower_jaw_file" text NOT NULL,
	"full_mouth_file" text NOT NULL,
	"smile_file" text NOT NULL,
	"label" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
