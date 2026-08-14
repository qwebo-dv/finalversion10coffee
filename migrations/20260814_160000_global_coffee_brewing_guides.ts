import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_coffee_details_brewing_methods"
      DROP CONSTRAINT IF EXISTS "products_coffee_details_brewing_methods_article_id_blog_posts_id_fk";

    DROP INDEX IF EXISTS "products_coffee_details_brewing_methods_article_idx";

    ALTER TABLE "products_coffee_details_brewing_methods"
      DROP COLUMN IF EXISTS "article_id";

    CREATE SEQUENCE IF NOT EXISTS "coffee_brewing_guides_id_seq";

    CREATE TABLE IF NOT EXISTS "coffee_brewing_guides" (
      "id" integer NOT NULL DEFAULT nextval('coffee_brewing_guides_id_seq'::regclass),
      "title" varchar NOT NULL,
      "article_id" integer,
      "sort_order" numeric NOT NULL DEFAULT 0,
      "is_visible" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id")
    );

    CREATE INDEX IF NOT EXISTS "coffee_brewing_guides_article_idx"
      ON "coffee_brewing_guides" USING btree ("article_id");
    CREATE INDEX IF NOT EXISTS "coffee_brewing_guides_sort_order_idx"
      ON "coffee_brewing_guides" USING btree ("sort_order");
    CREATE INDEX IF NOT EXISTS "coffee_brewing_guides_is_visible_idx"
      ON "coffee_brewing_guides" USING btree ("is_visible");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'coffee_brewing_guides_article_id_blog_posts_id_fk'
      ) THEN
        ALTER TABLE "coffee_brewing_guides"
          ADD CONSTRAINT "coffee_brewing_guides_article_id_blog_posts_id_fk"
          FOREIGN KEY ("article_id") REFERENCES "blog_posts"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "coffee_brewing_guides_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "coffee_brewing_guides_id";

    DROP TABLE IF EXISTS "coffee_brewing_guides" CASCADE;
    DROP SEQUENCE IF EXISTS "coffee_brewing_guides_id_seq";

    ALTER TABLE "products_coffee_details_brewing_methods"
      ADD COLUMN IF NOT EXISTS "article_id" integer;

    CREATE INDEX IF NOT EXISTS "products_coffee_details_brewing_methods_article_idx"
      ON "products_coffee_details_brewing_methods" USING btree ("article_id");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'products_coffee_details_brewing_methods_article_id_blog_posts_id_fk'
      ) THEN
        ALTER TABLE "products_coffee_details_brewing_methods"
          ADD CONSTRAINT "products_coffee_details_brewing_methods_article_id_blog_posts_id_fk"
          FOREIGN KEY ("article_id") REFERENCES "blog_posts"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;
  `)
}
