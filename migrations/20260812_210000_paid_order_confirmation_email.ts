import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "payment_confirmation_email_sent_at" timestamp(3) with time zone;

    UPDATE "orders"
       SET "sales_channel" = 'retail'::"enum_orders_sales_channel"
     WHERE "customer_type" = 'individual'
       AND "sales_channel" <> 'retail';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_confirmation_email_sent_at";
  `)
}
