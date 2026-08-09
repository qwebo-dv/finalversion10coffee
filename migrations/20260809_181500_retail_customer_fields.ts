import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

/**
 * Backfills fields that were added to the retail checkout and customer model
 * after the original production database had already been created.
 *
 * Payload's schema push is not a replacement for production migrations: a
 * missing column makes the whole collection query fail, which in turn leaves
 * its admin list page blank. Every statement is idempotent so it is safe on
 * existing and new databases.
 */
export async function ensureRetailCustomerFieldsSchema(db: MigrateUpArgs["db"]): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_type" varchar DEFAULT 'business';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "checkout_mode" varchar DEFAULT 'account';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" varchar DEFAULT 'invoice';
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_external_id" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_url" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_updated_at" timestamptz;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_full_name" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_email" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_phone" varchar;

    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "customer_type" varchar DEFAULT 'business';
    ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "address" varchar;

    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "audience" varchar DEFAULT 'business';

    UPDATE "orders"
      SET "customer_type" = COALESCE("customer_type", 'business'),
          "checkout_mode" = COALESCE("checkout_mode", 'account'),
          "payment_method" = COALESCE("payment_method", 'invoice');

    UPDATE "clients"
      SET "customer_type" = COALESCE("customer_type", 'business');

    UPDATE "promo_codes"
      SET "audience" = COALESCE("audience", 'business');

    CREATE INDEX IF NOT EXISTS "orders_customer_type_idx" ON "orders" USING btree ("customer_type");
    CREATE INDEX IF NOT EXISTS "clients_customer_type_idx" ON "clients" USING btree ("customer_type");
    CREATE INDEX IF NOT EXISTS "promo_codes_audience_idx" ON "promo_codes" USING btree ("audience");
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await ensureRetailCustomerFieldsSchema(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_customer_type_idx";
    DROP INDEX IF EXISTS "clients_customer_type_idx";
    DROP INDEX IF EXISTS "promo_codes_audience_idx";
  `)
}
