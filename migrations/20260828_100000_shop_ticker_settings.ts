import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "shop_ticker_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "enabled" boolean DEFAULT true,
      "pause_on_hover" boolean DEFAULT true,
      "background_color" varchar DEFAULT '#CBCAC6' NOT NULL,
      "text_color" varchar DEFAULT '#FFFFFF' NOT NULL,
      "marker_color" varchar DEFAULT '#FFFFFF' NOT NULL,
      "highlight_color" varchar DEFAULT '#FFFFFF' NOT NULL,
      "font_preset" varchar DEFAULT 'pixel' NOT NULL,
      "desktop_font_size" numeric DEFAULT 9 NOT NULL,
      "mobile_font_size" numeric DEFAULT 8 NOT NULL,
      "speed_seconds" numeric DEFAULT 92 NOT NULL,
      "marker" varchar DEFAULT '✦' NOT NULL,
      "uppercase" boolean DEFAULT true,
      "updated_at" timestamptz,
      "created_at" timestamptz
    );

    CREATE TABLE IF NOT EXISTS "shop_ticker_settings_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL,
      "highlighted" boolean DEFAULT false,
      CONSTRAINT "shop_ticker_settings_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."shop_ticker_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    );

    CREATE INDEX IF NOT EXISTS "shop_ticker_settings_items_order_idx" ON "shop_ticker_settings_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "shop_ticker_settings_items_parent_id_idx" ON "shop_ticker_settings_items" USING btree ("_parent_id");

    INSERT INTO "shop_ticker_settings" (
      "enabled", "pause_on_hover", "background_color", "text_color", "marker_color", "highlight_color",
      "font_preset", "desktop_font_size", "mobile_font_size", "speed_seconds", "marker", "uppercase", "created_at", "updated_at"
    )
    SELECT true, true, '#CBCAC6', '#FFFFFF', '#FFFFFF', '#FFFFFF', 'pixel', 9, 8, 92, '✦', true, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM "shop_ticker_settings");

    INSERT INTO "shop_ticker_settings_items" ("_order", "_parent_id", "id", "text", "highlighted")
    SELECT item."order", settings."id", item."id", item."text", item."highlighted"
    FROM "shop_ticker_settings" settings
    CROSS JOIN (VALUES
      (0, 'ticker-promo', 'Промокод 10COFFEE', true),
      (1, 'ticker-first-order', 'Скидка 10% на первый заказ', true),
      (2, 'ticker-roast', 'Свежая обжарка в Сочи', false),
      (3, 'ticker-delivery', 'Доставка по всей России', false),
      (4, 'ticker-bonuses', 'Бонусы за покупки', false),
      (5, 'ticker-catalog', 'Кофе, чай и аксессуары', false),
      (6, 'ticker-pickup', 'Самовывоз в Сочи', false),
      (7, 'ticker-grind', 'Помол под ваш способ заваривания', false)
    ) AS item("order", "id", "text", "highlighted")
    WHERE NOT EXISTS (
      SELECT 1 FROM "shop_ticker_settings_items" existing WHERE existing."_parent_id" = settings."id"
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "shop_ticker_settings_items";
    DROP TABLE IF EXISTS "shop_ticker_settings";
  `)
}
