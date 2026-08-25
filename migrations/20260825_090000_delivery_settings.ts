import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "delivery_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "cdek_packaging_enabled" boolean DEFAULT true,
      "package_s_length_cm" numeric DEFAULT 25,
      "package_s_width_cm" numeric DEFAULT 10,
      "package_s_height_cm" numeric DEFAULT 15,
      "package_s_max_weight_grams" numeric DEFAULT 2000,
      "package_s_cost_rubles" numeric DEFAULT 100,
      "package_m_length_cm" numeric DEFAULT 35,
      "package_m_width_cm" numeric DEFAULT 15,
      "package_m_height_cm" numeric DEFAULT 25,
      "package_m_max_weight_grams" numeric DEFAULT 5000,
      "package_m_cost_rubles" numeric DEFAULT 200,
      "package_l_length_cm" numeric DEFAULT 45,
      "package_l_width_cm" numeric DEFAULT 30,
      "package_l_height_cm" numeric DEFAULT 20,
      "package_l_max_weight_grams" numeric DEFAULT 12000,
      "package_l_cost_rubles" numeric DEFAULT 400,
      "fallback_package_size" varchar DEFAULT 'S',
      "updated_at" timestamptz,
      "created_at" timestamptz
    );

    INSERT INTO "delivery_settings" (
      "cdek_packaging_enabled",
      "package_s_length_cm", "package_s_width_cm", "package_s_height_cm", "package_s_max_weight_grams", "package_s_cost_rubles",
      "package_m_length_cm", "package_m_width_cm", "package_m_height_cm", "package_m_max_weight_grams", "package_m_cost_rubles",
      "package_l_length_cm", "package_l_width_cm", "package_l_height_cm", "package_l_max_weight_grams", "package_l_cost_rubles",
      "fallback_package_size", "created_at", "updated_at"
    )
    SELECT
      true,
      25, 10, 15, 2000, 100,
      35, 15, 25, 5000, 200,
      45, 30, 20, 12000, 400,
      'S', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM "delivery_settings");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "delivery_settings";`)
}
