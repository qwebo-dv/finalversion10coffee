import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"
import { sql } from "@payloadcms/db-postgres"

/**
 * Repairs production databases whose migration history was created after a
 * development schema push, while the preference source columns themselves
 * were never added. Every operation is idempotent so this is also safe when
 * the original migration ran successfully.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS coffee_details_country varchar;

    ALTER TABLE public.orders_items
      ADD COLUMN IF NOT EXISTS product_id varchar;

    CREATE INDEX IF NOT EXISTS orders_items_product_id_idx
      ON public.orders_items USING btree (product_id);

    UPDATE public.orders_items AS item
      SET product_id = (
        SELECT product.id::text
        FROM public.products AS product
        WHERE lower(trim(product.name)) = lower(trim(item.product_name))
        ORDER BY product.id
        LIMIT 1
      )
      WHERE item.product_id IS NULL
        AND item.product_name IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.products AS product
          WHERE lower(trim(product.name)) = lower(trim(item.product_name))
        );

    UPDATE public.products
      SET coffee_details_country = COALESCE(
        coffee_details_country,
        CASE
          WHEN slug IN ('espresso-brasil', 'espresso-back-to-black') THEN 'Бразилия'
          WHEN slug IN (
            'espresso-colombia',
            'colombia-popayan',
            'colombia-risaralda',
            'colombia-ruiz',
            'colombia-tabi-garzon'
          ) THEN 'Колумбия'
          WHEN slug IN (
            'espresso-ethiopia',
            'espresso-ethiopia-jimma',
            'ethiopia-gedeb',
            'ethiopia-guji-acacia',
            'ethiopia-guji-edera'
          ) THEN 'Эфиопия'
          WHEN slug = 'espresso-honduras' THEN 'Гондурас'
          WHEN slug = 'kenya-moigitu' THEN 'Кения'
          WHEN slug = 'rwanda-maraba' THEN 'Руанда'
          ELSE NULL
        END
      )
      WHERE details_schema = 'coffee';

    -- This marker is created by Payload's development schema push. Keeping it
    -- after a successful, explicit production migration would make every
    -- future migration command ask an interactive data-loss question again.
    DELETE FROM public.payload_migrations
      WHERE batch = -1;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Preserve restored historical links and editorial country metadata.
  await db.execute(sql`
    DROP INDEX IF EXISTS public.orders_items_product_id_idx;
  `)
}
