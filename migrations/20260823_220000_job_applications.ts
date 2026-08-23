import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_job_applications_status" AS ENUM ('new', 'contacted', 'reserve', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "job_application_files" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric,
      "prefix" varchar
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "job_application_files_filename_idx"
      ON "job_application_files" ("filename");
    CREATE INDEX IF NOT EXISTS "job_application_files_updated_at_idx"
      ON "job_application_files" ("updated_at");
    CREATE INDEX IF NOT EXISTS "job_application_files_created_at_idx"
      ON "job_application_files" ("created_at");

    CREATE TABLE IF NOT EXISTS "job_applications" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "desired_position" varchar NOT NULL,
      "email" varchar NOT NULL,
      "phone" varchar NOT NULL,
      "resume_id" integer NOT NULL,
      "status" "enum_job_applications_status" DEFAULT 'new' NOT NULL,
      "notes" varchar,
      "consent" boolean NOT NULL,
      "source" varchar DEFAULT 'website',
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT "job_applications_resume_id_job_application_files_id_fk"
        FOREIGN KEY ("resume_id") REFERENCES "public"."job_application_files"("id")
        ON DELETE restrict ON UPDATE no action
    );

    CREATE INDEX IF NOT EXISTS "job_applications_resume_idx" ON "job_applications" ("resume_id");
    CREATE INDEX IF NOT EXISTS "job_applications_updated_at_idx" ON "job_applications" ("updated_at");
    CREATE INDEX IF NOT EXISTS "job_applications_created_at_idx" ON "job_applications" ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "job_applications_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "job_application_files_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_job_applications_fk"
        FOREIGN KEY ("job_applications_id") REFERENCES "public"."job_applications"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_job_application_files_fk"
        FOREIGN KEY ("job_application_files_id") REFERENCES "public"."job_application_files"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_job_applications_id_idx"
      ON "payload_locked_documents_rels" ("job_applications_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_job_application_files_id_idx"
      ON "payload_locked_documents_rels" ("job_application_files_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "job_applications_id";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "job_application_files_id";
    DROP TABLE IF EXISTS "job_applications";
    DROP TABLE IF EXISTS "job_application_files";
    DROP TYPE IF EXISTS "enum_job_applications_status";
  `)
}
