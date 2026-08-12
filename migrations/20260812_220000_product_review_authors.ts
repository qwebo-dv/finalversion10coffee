import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "author_client_id" integer;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'product_reviews_author_client_id_clients_id_fk'
      ) THEN
        ALTER TABLE "product_reviews"
          ADD CONSTRAINT "product_reviews_author_client_id_clients_id_fk"
          FOREIGN KEY ("author_client_id") REFERENCES "public"."clients"("id")
          ON DELETE SET NULL ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "product_reviews_author_client_idx"
      ON "product_reviews" USING btree ("author_client_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "product_reviews_author_client_idx";
    ALTER TABLE "product_reviews"
      DROP CONSTRAINT IF EXISTS "product_reviews_author_client_id_clients_id_fk";
    ALTER TABLE "product_reviews" DROP COLUMN IF EXISTS "author_client_id";
  `)
}
