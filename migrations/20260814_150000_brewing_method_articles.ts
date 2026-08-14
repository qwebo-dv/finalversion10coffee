import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_coffee_details_brewing_methods"
      ADD COLUMN IF NOT EXISTS "article_id" integer;

    CREATE INDEX IF NOT EXISTS "products_coffee_details_brewing_methods_article_idx"
      ON "products_coffee_details_brewing_methods" USING btree ("article_id");

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
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

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products_coffee_details_brewing_methods"
      DROP CONSTRAINT IF EXISTS "products_coffee_details_brewing_methods_article_id_blog_posts_id_fk";

    DROP INDEX IF EXISTS "products_coffee_details_brewing_methods_article_idx";

    ALTER TABLE "products_coffee_details_brewing_methods"
      DROP COLUMN IF EXISTS "article_id";
  `)
}
