import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS cart_owner_id varchar,
      ADD COLUMN IF NOT EXISTS cart_cleared_at timestamptz;

    ALTER TABLE public.orders_items
      ADD COLUMN IF NOT EXISTS cart_item_id varchar;

    -- Keep a permanent audit snapshot so every production cleanup remains
    -- attributable and can be restored manually if a specific cart was
    -- classified incorrectly.
    CREATE TABLE IF NOT EXISTS public.paid_order_cart_cleanup_20260831 (
      cart_item_id integer PRIMARY KEY,
      client_id varchar NOT NULL,
      product_id integer NOT NULL,
      variant_id varchar NOT NULL,
      grind_option varchar,
      original_quantity numeric NOT NULL,
      removed_quantity numeric NOT NULL,
      remaining_quantity numeric NOT NULL,
      paid_order_id integer NOT NULL,
      payment_updated_at timestamptz NOT NULL,
      cleaned_at timestamptz DEFAULT now() NOT NULL
    );

    WITH paid_order_lines AS (
      SELECT
        item._parent_id AS order_id,
        item.product_id,
        item.variant_name,
        COALESCE(item.grind_option, '') AS grind_option,
        SUM(item.quantity)::numeric AS quantity
      FROM public.orders_items AS item
      WHERE item.product_id IS NOT NULL
      GROUP BY item._parent_id, item.product_id, item.variant_name, COALESCE(item.grind_option, '')
    ), matching_paid_carts AS (
      SELECT DISTINCT ON (cart.id)
        cart.id AS cart_item_id,
        cart.client_id,
        cart.product_id,
        cart.variant_id,
        cart.grind_option,
        cart.quantity AS original_quantity,
        LEAST(cart.quantity, line.quantity) AS removed_quantity,
        GREATEST(0, cart.quantity - line.quantity) AS remaining_quantity,
        paid_order.id AS paid_order_id,
        paid_order.payment_updated_at
      FROM public.cart_items AS cart
      INNER JOIN public.clients AS client
        ON client.supabase_id = cart.client_id
      INNER JOIN public.orders AS paid_order
        ON paid_order.client_id = client.id
       AND paid_order.sales_channel = 'retail'
       AND paid_order.checkout_mode = 'account'
       AND paid_order.payment_method = 'yookassa'
       AND paid_order.payment_status = 'paid'
       AND paid_order.payment_updated_at IS NOT NULL
       AND cart.updated_at <= paid_order.payment_updated_at
      INNER JOIN paid_order_lines AS line
        ON line.order_id = paid_order.id
       AND line.product_id = cart.product_id::varchar
       AND line.grind_option = COALESCE(cart.grind_option, '')
      INNER JOIN public.products_variants AS variant
        ON variant._parent_id = cart.product_id
       AND variant.id = cart.variant_id
       AND variant.name = line.variant_name
      ORDER BY cart.id, paid_order.payment_updated_at DESC
    )
    INSERT INTO public.paid_order_cart_cleanup_20260831 (
      cart_item_id,
      client_id,
      product_id,
      variant_id,
      grind_option,
      original_quantity,
      removed_quantity,
      remaining_quantity,
      paid_order_id,
      payment_updated_at
    )
    SELECT
      cart_item_id,
      client_id,
      product_id,
      variant_id,
      grind_option,
      original_quantity,
      removed_quantity,
      remaining_quantity,
      paid_order_id,
      payment_updated_at
    FROM matching_paid_carts
    ON CONFLICT (cart_item_id) DO NOTHING;

    UPDATE public.cart_items AS cart
       SET quantity = audit.remaining_quantity,
           updated_at = now()
      FROM public.paid_order_cart_cleanup_20260831 AS audit
     WHERE cart.id = audit.cart_item_id
       AND cart.client_id = audit.client_id
       AND audit.remaining_quantity > 0;

    DELETE FROM public.cart_items AS cart
     USING public.paid_order_cart_cleanup_20260831 AS audit
     WHERE cart.id = audit.cart_item_id
       AND cart.client_id = audit.client_id
       AND audit.remaining_quantity <= 0;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.orders_items
      DROP COLUMN IF EXISTS cart_item_id;

    ALTER TABLE public.orders
      DROP COLUMN IF EXISTS cart_owner_id,
      DROP COLUMN IF EXISTS cart_cleared_at;

    -- paid_order_cart_cleanup_20260831 is intentionally retained as a
    -- recovery/audit record of the production data cleanup.
  `)
}
