import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function ensureSberAcquiringSettingsSchema(db: MigrateUpArgs["db"]): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_enabled" boolean DEFAULT false;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_environment" varchar DEFAULT 'production';
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_api_url" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_username" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_password" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_return_url" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_fail_url" varchar;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "sber_acquiring_callback_url" varchar;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await ensureSberAcquiringSettingsSchema(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_enabled";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_environment";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_api_url";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_username";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_password";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_return_url";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_fail_url";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "sber_acquiring_callback_url";
  `)
}
