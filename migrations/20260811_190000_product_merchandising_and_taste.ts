import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_popular" boolean DEFAULT false;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "coffee_details_bitterness" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "coffee_details_sweetness" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "coffee_details_body" numeric;

    UPDATE "products"
       SET "coffee_details_acidity" = 7
     WHERE "coffee_details_acidity" > 7;

    CREATE INDEX IF NOT EXISTS "products_is_popular_idx" ON "products" USING btree ("is_popular");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "products_is_popular_idx";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "is_popular";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "coffee_details_bitterness";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "coffee_details_sweetness";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "coffee_details_body";
  `)
}
