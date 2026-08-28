import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "promo_codes"
      ADD COLUMN IF NOT EXISTS "first_order_only" boolean DEFAULT false;

    UPDATE "promo_codes"
      SET "discount_type" = 'percentage',
          "discount_value" = 10,
          "audience" = 'individual',
          "is_single_use" = true,
          "first_order_only" = true,
          "is_active" = true,
          "restricted_to_email" = NULL,
          "updated_at" = now()
      WHERE upper("code") = '10COFFEE';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "promo_codes"
      DROP COLUMN IF EXISTS "first_order_only";
  `)
}
