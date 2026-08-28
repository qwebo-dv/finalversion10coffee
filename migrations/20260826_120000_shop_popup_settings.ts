import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "shop_popup_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT false,
      "campaign_version" numeric DEFAULT 1 NOT NULL,
      "badge_text" varchar DEFAULT 'Предложение для нового покупателя' NOT NULL,
      "title" varchar DEFAULT 'Дарим 10% на первый заказ и бонусы за каждый следующий' NOT NULL,
      "description" jsonb,
      "promo_code" varchar DEFAULT '10COFFEE' NOT NULL,
      "cta_label" varchar DEFAULT 'Получить скидку 10% и зарегистрироваться' NOT NULL,
      "decline_label" varchar DEFAULT 'Нет, спасибо, я предпочитаю платить полную цену' NOT NULL,
      "visual_mode" varchar DEFAULT 'coffee' NOT NULL,
      "visual_image_id" integer,
      "visual_caption" varchar DEFAULT 'Свежая обжарка · бонусы с каждой покупки',
      "updated_at" timestamptz,
      "created_at" timestamptz,
      CONSTRAINT "shop_popup_settings_visual_image_id_media_id_fk"
        FOREIGN KEY ("visual_image_id") REFERENCES "public"."media"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS "shop_popup_settings_visual_image_idx" ON "shop_popup_settings" USING btree ("visual_image_id");

    INSERT INTO "shop_popup_settings" (
      "enabled", "campaign_version", "badge_text", "title", "description", "promo_code",
      "cta_label", "decline_label", "visual_mode", "visual_caption", "created_at", "updated_at"
    )
    SELECT
      false, 1, 'Предложение для нового покупателя',
      'Дарим 10% на первый заказ и бонусы за каждый следующий',
      '{"root":{"type":"root","format":"","indent":0,"version":1,"direction":"ltr","children":[{"type":"paragraph","format":"","indent":0,"version":1,"direction":"ltr","textFormat":0,"textStyle":"","children":[{"type":"text","version":1,"text":"Зарегистрируйтесь в личном кабинете 10coffee, используйте промокод 10COFFEE, копите бонусы с покупок и оплачивайте ими новые заказы.","format":0,"style":"","mode":"normal","detail":0}]}]}}'::jsonb,
      '10COFFEE',
      'Получить скидку 10% и зарегистрироваться',
      'Нет, спасибо, я предпочитаю платить полную цену',
      'coffee', 'Свежая обжарка · бонусы с каждой покупки', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM "shop_popup_settings");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "shop_popup_settings";`)
}
