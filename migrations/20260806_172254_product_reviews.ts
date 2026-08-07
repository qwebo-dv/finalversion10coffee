import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function ensureProductReviewsSchema(db: MigrateUpArgs['db']): Promise<void> {
  await db.execute(sql`
   CREATE SEQUENCE IF NOT EXISTS "product_reviews_id_seq";

   CREATE TABLE IF NOT EXISTS "product_reviews" (
   	"id" integer NOT NULL DEFAULT nextval('product_reviews_id_seq'::regclass),
   	"product_id" integer,
   	"author_name" varchar,
   	"rating" numeric,
   	"comment" text,
   	"client_id" varchar,
   	"status" varchar DEFAULT 'approved',
   	"created_at" timestamptz NOT NULL DEFAULT now(),
   	"updated_at" timestamptz NOT NULL DEFAULT now(),
   	PRIMARY KEY ("id")
   );

   ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manual_rating" numeric;
   ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manual_rating_count" integer;

   ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "product_reviews_id" integer;

   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_product_id_products_id_fk') THEN
       ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE no action;
     END IF;
   END $$;

   ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "client_id" varchar;
   ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'approved';

   CREATE INDEX IF NOT EXISTS "product_reviews_product_idx" ON "product_reviews" USING btree ("product_id");
   CREATE INDEX IF NOT EXISTS "product_reviews_created_at_idx" ON "product_reviews" USING btree ("created_at" DESC);
   CREATE INDEX IF NOT EXISTS "product_reviews_client_id_idx" ON "product_reviews" USING btree ("client_id");
   CREATE INDEX IF NOT EXISTS "product_reviews_status_idx" ON "product_reviews" USING btree ("status");`)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await ensureProductReviewsSchema(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "product_reviews" CASCADE;
   ALTER TABLE "products" DROP COLUMN IF EXISTS "manual_rating";
   ALTER TABLE "products" DROP COLUMN IF EXISTS "manual_rating_count";
   ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "product_reviews_id";`)
}
