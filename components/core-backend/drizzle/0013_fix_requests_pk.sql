-- Fix existing requests table to use single serial primary key "id"
-- and align column names with current Drizzle schema.

-- Drop any existing primary key so we can add "id" cleanly.
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT tc.constraint_name INTO pk_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_name = 'requests'
    AND tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "public"."requests" DROP CONSTRAINT %I', pk_name);
  END IF;
END$$;

-- Ensure status enum is applied.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE "public"."requests" ALTER COLUMN "status" SET DEFAULT ''pending''::status';
    EXECUTE 'ALTER TABLE "public"."requests" ALTER COLUMN "status" SET NOT NULL';
    EXECUTE 'ALTER TABLE "public"."requests" ALTER COLUMN "status" SET DATA TYPE status USING "status"::status';
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END$$;

-- Add missing columns in a safe way.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'id'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD COLUMN "id" integer';
    EXECUTE 'CREATE SEQUENCE IF NOT EXISTS requests_id_seq OWNED BY "public"."requests"."id"';
    EXECUTE 'ALTER TABLE "public"."requests" ALTER COLUMN "id" SET DEFAULT nextval(''requests_id_seq'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'sender_id'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD COLUMN "sender_id" text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'receiver_id'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD COLUMN "receiver_id" text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD COLUMN "created_at" timestamp DEFAULT now()';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'updated_at'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD COLUMN "updated_at" timestamp DEFAULT now()';
  END IF;
END$$;

-- Backfill sender/receiver to new snake_case columns if old camelCase columns exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'senderId'
  ) THEN
    EXECUTE 'UPDATE "public"."requests" SET "sender_id" = "senderId" WHERE "sender_id" IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'receiverId'
  ) THEN
    EXECUTE 'UPDATE "public"."requests" SET "receiver_id" = "receiverId" WHERE "receiver_id" IS NULL';
  END IF;
END$$;

-- Backfill id from old "is" column if present, then fill any remaining rows from sequence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'is'
  ) THEN
    EXECUTE 'UPDATE "public"."requests" SET "id" = COALESCE("id", "is")';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'id'
  ) THEN
    EXECUTE 'UPDATE "public"."requests" SET "id" = nextval(''requests_id_seq'') WHERE "id" IS NULL';
    EXECUTE 'SELECT setval(''requests_id_seq'', (SELECT COALESCE(MAX("id"), 0) FROM "public"."requests"))';
    EXECUTE 'ALTER TABLE "public"."requests" ALTER COLUMN "id" SET NOT NULL';
  END IF;
END$$;

-- Drop obsolete columns if they still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'is'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" DROP COLUMN "is"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'senderId'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" DROP COLUMN "senderId"';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'receiverId'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" DROP COLUMN "receiverId"';
  END IF;
END$$;

-- Add primary key on id if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'requests' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id")';
  END IF;
END$$;

-- Add foreign keys to users on sender_id / receiver_id if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'requests' AND constraint_name = 'requests_sender_id_users_fusion_auth_id_fk'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD CONSTRAINT "requests_sender_id_users_fusion_auth_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("fusion_auth_id")';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'requests' AND constraint_name = 'requests_receiver_id_users_fusion_auth_id_fk'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."requests" ADD CONSTRAINT "requests_receiver_id_users_fusion_auth_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("fusion_auth_id")';
  END IF;
END$$;
