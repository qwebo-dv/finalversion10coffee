import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_orders_delivery_method
      ADD VALUE IF NOT EXISTS 'yandex_delivery';

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS yandex_delivery_type varchar,
      ADD COLUMN IF NOT EXISTS yandex_pickup_point_id varchar,
      ADD COLUMN IF NOT EXISTS yandex_pickup_point_name varchar,
      ADD COLUMN IF NOT EXISTS yandex_request_id varchar,
      ADD COLUMN IF NOT EXISTS yandex_delivery_status varchar;

    CREATE UNIQUE INDEX IF NOT EXISTS orders_yandex_request_id_unique
      ON public.orders (yandex_request_id)
      WHERE yandex_request_id IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS public.orders_yandex_request_id_unique;
    ALTER TABLE public.orders
      DROP COLUMN IF EXISTS yandex_delivery_type,
      DROP COLUMN IF EXISTS yandex_pickup_point_id,
      DROP COLUMN IF EXISTS yandex_pickup_point_name,
      DROP COLUMN IF EXISTS yandex_request_id,
      DROP COLUMN IF EXISTS yandex_delivery_status;
  `)
}
