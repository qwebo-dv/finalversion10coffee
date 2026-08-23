import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      enum_schema text;
      enum_name text;
    BEGIN
      SELECT namespace.nspname, value_type.typname
        INTO enum_schema, enum_name
        FROM pg_attribute column_definition
        JOIN pg_class table_definition
          ON table_definition.oid = column_definition.attrelid
        JOIN pg_namespace table_namespace
          ON table_namespace.oid = table_definition.relnamespace
        JOIN pg_type value_type
          ON value_type.oid = column_definition.atttypid
        JOIN pg_namespace namespace
          ON namespace.oid = value_type.typnamespace
       WHERE table_namespace.nspname = 'public'
         AND table_definition.relname = 'orders'
         AND column_definition.attname = 'delivery_method'
         AND column_definition.attnum > 0
         AND NOT column_definition.attisdropped
         AND value_type.typtype = 'e'
       LIMIT 1;

      IF enum_name IS NOT NULL THEN
        EXECUTE format(
          'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
          enum_schema,
          enum_name,
          'yandex_delivery'
        );
      END IF;
    END $$;

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
