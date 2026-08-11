import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "shop_id" varchar;
    ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "secret_key" varchar;
    ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "webhook_url" varchar;
    UPDATE "payment_settings"
       SET "enabled" = false,
           "webhook_url" = COALESCE("webhook_url", 'https://shop.10coffee.ru/api/shop/payments/yookassa/webhook')
     WHERE "shop_id" IS NULL OR "secret_key" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payment_settings" DROP COLUMN IF EXISTS "shop_id";
    ALTER TABLE "payment_settings" DROP COLUMN IF EXISTS "secret_key";
    ALTER TABLE "payment_settings" DROP COLUMN IF EXISTS "webhook_url";
  `)
}
