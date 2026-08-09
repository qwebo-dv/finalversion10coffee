import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

export async function ensurePaymentSettingsSchema(db: MigrateUpArgs["db"]): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payment_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT false,
      "environment" varchar DEFAULT 'production',
      "api_url" varchar,
      "username" varchar,
      "password" varchar,
      "return_url" varchar,
      "fail_url" varchar,
      "callback_url" varchar,
      "updated_at" timestamptz,
      "created_at" timestamptz
    );

    INSERT INTO "payment_settings" (
      "enabled", "environment", "api_url", "username", "password",
      "return_url", "fail_url", "callback_url", "created_at", "updated_at"
    )
    SELECT
      "sber_acquiring_enabled", "sber_acquiring_environment", "sber_acquiring_api_url",
      "sber_acquiring_username", "sber_acquiring_password", "sber_acquiring_return_url",
      "sber_acquiring_fail_url", "sber_acquiring_callback_url", now(), now()
    FROM "site_settings"
    WHERE NOT EXISTS (SELECT 1 FROM "payment_settings");
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await ensurePaymentSettingsSchema(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "payment_settings";`)
}
