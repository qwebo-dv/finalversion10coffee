import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "promo_codes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "clients_product_discounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"discount_percent" numeric NOT NULL
  );
  
  CREATE TABLE "clients_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  ALTER TABLE "orders_items" ADD COLUMN "discount_percent" numeric DEFAULT 0;
  ALTER TABLE "orders_items" ADD COLUMN "discount_amount" numeric DEFAULT 0;
  ALTER TABLE "promo_codes_rels" ADD CONSTRAINT "promo_codes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promo_codes_rels" ADD CONSTRAINT "promo_codes_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients_product_discounts" ADD CONSTRAINT "clients_product_discounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients_rels" ADD CONSTRAINT "clients_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients_rels" ADD CONSTRAINT "clients_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "promo_codes_rels_order_idx" ON "promo_codes_rels" USING btree ("order");
  CREATE INDEX "promo_codes_rels_parent_idx" ON "promo_codes_rels" USING btree ("parent_id");
  CREATE INDEX "promo_codes_rels_path_idx" ON "promo_codes_rels" USING btree ("path");
  CREATE INDEX "promo_codes_rels_products_id_idx" ON "promo_codes_rels" USING btree ("products_id");
  CREATE INDEX "clients_product_discounts_order_idx" ON "clients_product_discounts" USING btree ("_order");
  CREATE INDEX "clients_product_discounts_parent_id_idx" ON "clients_product_discounts" USING btree ("_parent_id");
  CREATE INDEX "clients_rels_order_idx" ON "clients_rels" USING btree ("order");
  CREATE INDEX "clients_rels_parent_idx" ON "clients_rels" USING btree ("parent_id");
  CREATE INDEX "clients_rels_path_idx" ON "clients_rels" USING btree ("path");
  CREATE INDEX "clients_rels_products_id_idx" ON "clients_rels" USING btree ("products_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "promo_codes_rels" CASCADE;
  DROP TABLE "clients_product_discounts" CASCADE;
  DROP TABLE "clients_rels" CASCADE;
  ALTER TABLE "orders_items" DROP COLUMN "discount_percent";
  ALTER TABLE "orders_items" DROP COLUMN "discount_amount";`)
}
