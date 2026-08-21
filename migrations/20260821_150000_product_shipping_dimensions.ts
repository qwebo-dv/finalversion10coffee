import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.products_variants
      ADD COLUMN IF NOT EXISTS shipping_length_cm numeric,
      ADD COLUMN IF NOT EXISTS shipping_width_cm numeric,
      ADD COLUMN IF NOT EXISTS shipping_height_cm numeric,
      ADD COLUMN IF NOT EXISTS shipping_weight_grams numeric;

    ALTER TABLE public.orders_items
      ADD COLUMN IF NOT EXISTS shipping_length_cm numeric,
      ADD COLUMN IF NOT EXISTS shipping_width_cm numeric,
      ADD COLUMN IF NOT EXISTS shipping_height_cm numeric,
      ADD COLUMN IF NOT EXISTS shipping_weight_grams numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.orders_items
      DROP COLUMN IF EXISTS shipping_length_cm,
      DROP COLUMN IF EXISTS shipping_width_cm,
      DROP COLUMN IF EXISTS shipping_height_cm,
      DROP COLUMN IF EXISTS shipping_weight_grams;

    ALTER TABLE public.products_variants
      DROP COLUMN IF EXISTS shipping_length_cm,
      DROP COLUMN IF EXISTS shipping_width_cm,
      DROP COLUMN IF EXISTS shipping_height_cm,
      DROP COLUMN IF EXISTS shipping_weight_grams;
  `)
}
