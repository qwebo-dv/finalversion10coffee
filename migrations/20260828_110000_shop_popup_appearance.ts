import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "shop_popup_settings"
      ADD COLUMN IF NOT EXISTS "title_desktop_font_size" numeric DEFAULT 42 NOT NULL,
      ADD COLUMN IF NOT EXISTS "title_mobile_font_size" numeric DEFAULT 30 NOT NULL,
      ADD COLUMN IF NOT EXISTS "description_desktop_font_size" numeric DEFAULT 15 NOT NULL,
      ADD COLUMN IF NOT EXISTS "description_mobile_font_size" numeric DEFAULT 14 NOT NULL,
      ADD COLUMN IF NOT EXISTS "button_desktop_font_size" numeric DEFAULT 16 NOT NULL,
      ADD COLUMN IF NOT EXISTS "button_mobile_font_size" numeric DEFAULT 14 NOT NULL,
      ADD COLUMN IF NOT EXISTS "badge_font_size" numeric DEFAULT 12 NOT NULL,
      ADD COLUMN IF NOT EXISTS "decline_font_size" numeric DEFAULT 12 NOT NULL,
      ADD COLUMN IF NOT EXISTS "visual_caption_font_size" numeric DEFAULT 10 NOT NULL,
      ADD COLUMN IF NOT EXISTS "promo_code_font_size" numeric DEFAULT 20 NOT NULL,
      ADD COLUMN IF NOT EXISTS "panel_background_color" varchar DEFAULT '#F8F5F1' NOT NULL,
      ADD COLUMN IF NOT EXISTS "title_color" varchar DEFAULT '#1D1D1B' NOT NULL,
      ADD COLUMN IF NOT EXISTS "accent_color" varchar DEFAULT '#E6610D' NOT NULL,
      ADD COLUMN IF NOT EXISTS "description_color" varchar DEFAULT '#655C55' NOT NULL,
      ADD COLUMN IF NOT EXISTS "badge_background_color" varchar DEFAULT '#FAEAD5' NOT NULL,
      ADD COLUMN IF NOT EXISTS "badge_text_color" varchar DEFAULT '#C84E00' NOT NULL,
      ADD COLUMN IF NOT EXISTS "button_background_color" varchar DEFAULT '#5B328A' NOT NULL,
      ADD COLUMN IF NOT EXISTS "button_text_color" varchar DEFAULT '#FFFFFF' NOT NULL,
      ADD COLUMN IF NOT EXISTS "decline_text_color" varchar DEFAULT '#7D736B' NOT NULL,
      ADD COLUMN IF NOT EXISTS "visual_text_color" varchar DEFAULT '#FFFFFF' NOT NULL,
      ADD COLUMN IF NOT EXISTS "visual_background_color" varchar DEFAULT '#5B328A' NOT NULL,
      ADD COLUMN IF NOT EXISTS "visual_glow_color" varchar DEFAULT '#E6610D' NOT NULL,
      ADD COLUMN IF NOT EXISTS "promo_plate_background_color" varchar DEFAULT '#1D1D1B' NOT NULL,
      ADD COLUMN IF NOT EXISTS "promo_plate_text_color" varchar DEFAULT '#FFFFFF' NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "shop_popup_settings"
      DROP COLUMN IF EXISTS "title_desktop_font_size",
      DROP COLUMN IF EXISTS "title_mobile_font_size",
      DROP COLUMN IF EXISTS "description_desktop_font_size",
      DROP COLUMN IF EXISTS "description_mobile_font_size",
      DROP COLUMN IF EXISTS "button_desktop_font_size",
      DROP COLUMN IF EXISTS "button_mobile_font_size",
      DROP COLUMN IF EXISTS "badge_font_size",
      DROP COLUMN IF EXISTS "decline_font_size",
      DROP COLUMN IF EXISTS "visual_caption_font_size",
      DROP COLUMN IF EXISTS "promo_code_font_size",
      DROP COLUMN IF EXISTS "panel_background_color",
      DROP COLUMN IF EXISTS "title_color",
      DROP COLUMN IF EXISTS "accent_color",
      DROP COLUMN IF EXISTS "description_color",
      DROP COLUMN IF EXISTS "badge_background_color",
      DROP COLUMN IF EXISTS "badge_text_color",
      DROP COLUMN IF EXISTS "button_background_color",
      DROP COLUMN IF EXISTS "button_text_color",
      DROP COLUMN IF EXISTS "decline_text_color",
      DROP COLUMN IF EXISTS "visual_text_color",
      DROP COLUMN IF EXISTS "visual_background_color",
      DROP COLUMN IF EXISTS "visual_glow_color",
      DROP COLUMN IF EXISTS "promo_plate_background_color",
      DROP COLUMN IF EXISTS "promo_plate_text_color";
  `)
}
