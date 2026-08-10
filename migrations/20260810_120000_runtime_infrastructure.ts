import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

/**
 * Infrastructure that used to be created lazily from application requests.
 *
 * Runtime DDL is unsafe under concurrency and makes deployments depend on the
 * first user request. Keep all schema ownership in the migration pipeline.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
      ON public.auth_sessions (user_id);
    CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
      ON public.auth_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS public.moysklad_sync_logs (
      id bigserial PRIMARY KEY,
      entity_type text NOT NULL,
      local_id text,
      moysklad_id text,
      direction text NOT NULL,
      status text NOT NULL,
      message text,
      payload jsonb,
      response jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS moysklad_sync_logs_created_at_idx
      ON public.moysklad_sync_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS moysklad_sync_logs_entity_local_idx
      ON public.moysklad_sync_logs (entity_type, local_id);

    ALTER TABLE public.companies
      ADD COLUMN IF NOT EXISTS moysklad_counterparty_id text;
    CREATE INDEX IF NOT EXISTS companies_moysklad_counterparty_id_idx
      ON public.companies (moysklad_counterparty_id);

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS moysklad_counterparty_id varchar,
      ADD COLUMN IF NOT EXISTS moysklad_invoice_out_id varchar,
      ADD COLUMN IF NOT EXISTS moysklad_stock_loss_id varchar,
      ADD COLUMN IF NOT EXISTS moysklad_stock_loss_synced_at timestamptz,
      ADD COLUMN IF NOT EXISTS moysklad_stock_loss_error text;
    CREATE INDEX IF NOT EXISTS orders_moysklad_counterparty_id_idx
      ON public.orders (moysklad_counterparty_id);
    CREATE INDEX IF NOT EXISTS orders_moysklad_invoice_out_id_idx
      ON public.orders (moysklad_invoice_out_id);
    CREATE INDEX IF NOT EXISTS orders_moysklad_stock_loss_id_idx
      ON public.orders (moysklad_stock_loss_id);

    -- Payload stores the Orders array in orders_items (plural).
    ALTER TABLE public.orders_items
      ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

    ALTER TABLE public.product_reviews
      ALTER COLUMN status SET DEFAULT 'pending';

    -- Collapse historical duplicate cart lines before enforcing their natural key.
    WITH cart_totals AS (
      SELECT
        MIN(id) AS keep_id,
        SUM(quantity) AS total_quantity,
        client_id,
        product_id,
        variant_id,
        COALESCE(grind_option, '') AS normalized_grind
      FROM public.cart_items
      GROUP BY client_id, product_id, variant_id, COALESCE(grind_option, '')
      HAVING COUNT(*) > 1
    )
    UPDATE public.cart_items AS item
      SET quantity = totals.total_quantity
      FROM cart_totals AS totals
      WHERE item.id = totals.keep_id;

    WITH duplicate_cart_lines AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY client_id, product_id, variant_id, COALESCE(grind_option, '')
          ORDER BY id
        ) AS row_number
      FROM public.cart_items
    )
    DELETE FROM public.cart_items AS item
      USING duplicate_cart_lines AS duplicate
      WHERE item.id = duplicate.id AND duplicate.row_number > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS cart_items_natural_key_idx
      ON public.cart_items (
        client_id,
        product_id,
        variant_id,
        (COALESCE(grind_option, ''))
      );

    CREATE SEQUENCE IF NOT EXISTS public.order_number_seq
      AS integer START WITH 1 INCREMENT BY 1;

    SELECT setval(
      'public.order_number_seq',
      GREATEST(
        COALESCE((
          SELECT MAX(substring(order_id FROM '^10C-(\\d+)$')::integer)
          FROM public.orders
          WHERE order_id ~ '^10C-\\d+$'
        ), 0),
        (SELECT last_value::integer FROM public.order_number_seq),
        1
      ),
      (SELECT is_called FROM public.order_number_seq)
        OR EXISTS (SELECT 1 FROM public.orders WHERE order_id ~ '^10C-\\d+$')
    );

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_orders_delivery_method'
      ) THEN
        ALTER TYPE public.enum_orders_delivery_method
          ADD VALUE IF NOT EXISTS 'sochi_delivery';
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Do not drop data-bearing operational tables or order identifiers on rollback.
  // Removing only the optional indexes is safe and keeps existing data readable.
  await db.execute(sql`
    DROP INDEX IF EXISTS public.moysklad_sync_logs_created_at_idx;
    DROP INDEX IF EXISTS public.moysklad_sync_logs_entity_local_idx;
  `)
}
