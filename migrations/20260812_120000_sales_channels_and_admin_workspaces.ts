import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

/**
 * Introduces explicit B2B/B2C sales channels without removing the legacy
 * customer_type discriminator. Keeping both fields makes the deployment
 * backwards-compatible while channel-specific workflows are rolled out.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'super_admin';
    ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'content_manager';
    ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'wholesale_manager';
    ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'retail_manager';
    ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'support';
    ALTER TYPE "enum_admins_role" ADD VALUE IF NOT EXISTS 'integration_operator';

    DO $$ BEGIN
      CREATE TYPE "enum_orders_sales_channel" AS ENUM ('wholesale', 'retail');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "enum_clients_sales_channel" AS ENUM ('wholesale', 'retail');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "sales_channel" "enum_orders_sales_channel" DEFAULT 'wholesale';
    ALTER TABLE "clients"
      ADD COLUMN IF NOT EXISTS "sales_channel" "enum_clients_sales_channel" DEFAULT 'wholesale';
    ALTER TABLE "admins"
      ADD COLUMN IF NOT EXISTS "can_access_wholesale" boolean DEFAULT true,
      ADD COLUMN IF NOT EXISTS "can_access_retail" boolean DEFAULT true;

    UPDATE "orders"
       SET "sales_channel" = CASE
         WHEN "customer_type" = 'individual' THEN 'retail'::"enum_orders_sales_channel"
         ELSE 'wholesale'::"enum_orders_sales_channel"
       END
     WHERE "sales_channel" IS NULL
        OR ("sales_channel" = 'wholesale' AND "customer_type" = 'individual');

    UPDATE "clients"
       SET "sales_channel" = CASE
         WHEN "customer_type" = 'individual' THEN 'retail'::"enum_clients_sales_channel"
         ELSE 'wholesale'::"enum_clients_sales_channel"
       END
     WHERE "sales_channel" IS NULL
        OR ("sales_channel" = 'wholesale' AND "customer_type" = 'individual');

    UPDATE "admins"
       SET "can_access_wholesale" = COALESCE("can_access_wholesale", true),
           "can_access_retail" = COALESCE("can_access_retail", true);

    ALTER TABLE "orders" ALTER COLUMN "sales_channel" SET NOT NULL;
    ALTER TABLE "clients" ALTER COLUMN "sales_channel" SET NOT NULL;
    CREATE INDEX IF NOT EXISTS "orders_sales_channel_idx" ON "orders" ("sales_channel");
    CREATE INDEX IF NOT EXISTS "clients_sales_channel_idx" ON "clients" ("sales_channel");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_sales_channel_idx";
    DROP INDEX IF EXISTS "clients_sales_channel_idx";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "sales_channel";
    ALTER TABLE "clients" DROP COLUMN IF EXISTS "sales_channel";
    ALTER TABLE "admins" DROP COLUMN IF EXISTS "can_access_wholesale";
    ALTER TABLE "admins" DROP COLUMN IF EXISTS "can_access_retail";
    DROP TYPE IF EXISTS "enum_orders_sales_channel";
    DROP TYPE IF EXISTS "enum_clients_sales_channel";
  `)

  // PostgreSQL enum values cannot be safely removed without rewriting the
  // type. The added admin role values intentionally remain available.
}
