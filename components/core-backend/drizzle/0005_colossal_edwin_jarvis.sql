ALTER TABLE "dataset_images" ALTER COLUMN "label" SET DATA TYPE text[];--> statement-breakpoint
ALTER TABLE "dataset_images" ALTER COLUMN "label" DROP NOT NULL;