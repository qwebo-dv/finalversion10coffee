import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "enum_loyalty_operations_type" AS ENUM ('accrual', 'reservation', 'redemption', 'release', 'refund', 'reversal', 'expiry'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "enum_loyalty_operations_status" AS ENUM ('pending', 'active', 'released', 'reversed', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE IF NOT EXISTS "loyalty_operations" (
      "id" serial PRIMARY KEY NOT NULL,
      "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE restrict,
      "order_id" integer REFERENCES "orders"("id") ON DELETE set null,
      "type" "enum_loyalty_operations_type" NOT NULL,
      "amount" numeric NOT NULL,
      "status" "enum_loyalty_operations_status" NOT NULL DEFAULT 'active',
      "idempotency_key" varchar NOT NULL,
      "expires_at" timestamptz,
      "note" varchar,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT "loyalty_operations_idempotency_key_unique" UNIQUE("idempotency_key")
    );
    CREATE INDEX IF NOT EXISTS "loyalty_operations_client_idx" ON "loyalty_operations" ("client_id");
    CREATE INDEX IF NOT EXISTS "loyalty_operations_order_idx" ON "loyalty_operations" ("order_id");
    CREATE INDEX IF NOT EXISTS "loyalty_operations_expires_at_idx" ON "loyalty_operations" ("expires_at");
    -- Payload stores document locks for every collection in this technical table.
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "loyalty_operations_id" integer;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "loyalty_points_redeemed" numeric DEFAULT 0;

    CREATE TABLE IF NOT EXISTS "loyalty_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT false,
      "expiry_days" numeric DEFAULT 60,
      "balance_cap" numeric DEFAULT 5000,
      "max_redemption_percent" numeric DEFAULT 20,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "loyalty_settings_tiers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "loyalty_settings"("id") ON DELETE cascade,
      "id" varchar PRIMARY KEY NOT NULL,
      "min_subtotal" numeric NOT NULL,
      "percent" numeric NOT NULL
    );
    INSERT INTO "loyalty_settings" ("enabled", "expiry_days", "balance_cap", "max_redemption_percent", "created_at", "updated_at")
    SELECT false, 60, 5000, 20, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM "loyalty_settings");

    INSERT INTO "loyalty_settings_tiers" ("_order", "_parent_id", "id", "min_subtotal", "percent")
    SELECT tier."order", settings."id", tier."id", tier."min_subtotal", tier."percent"
    FROM "loyalty_settings" settings
    CROSS JOIN (VALUES
      (0, 'loyalty-tier-3', 0, 3),
      (1, 'loyalty-tier-5', 1000, 5),
      (2, 'loyalty-tier-12', 5000, 12)
    ) AS tier("order", "id", "min_subtotal", "percent")
    WHERE NOT EXISTS (SELECT 1 FROM "loyalty_settings_tiers" existing WHERE existing."_parent_id" = settings."id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "loyalty_operations_id";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "loyalty_points_redeemed";
    DROP TABLE IF EXISTS "loyalty_settings_tiers";
    DROP TABLE IF EXISTS "loyalty_settings";
    DROP TABLE IF EXISTS "loyalty_operations";
    DROP TYPE IF EXISTS "enum_loyalty_operations_status";
    DROP TYPE IF EXISTS "enum_loyalty_operations_type";
  `)
}
