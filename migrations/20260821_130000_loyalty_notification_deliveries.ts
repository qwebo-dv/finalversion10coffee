import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "loyalty_notification_deliveries" (
      "id" serial PRIMARY KEY NOT NULL,
      "notification_key" varchar NOT NULL,
      "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
      "channel" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'pending',
      "attempts" integer NOT NULL DEFAULT 1,
      "error" varchar,
      "updated_at" timestamptz DEFAULT now() NOT NULL,
      "created_at" timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT "loyalty_notification_deliveries_key_channel_unique" UNIQUE("notification_key", "channel")
    );
    CREATE INDEX IF NOT EXISTS "loyalty_notification_deliveries_client_idx"
      ON "loyalty_notification_deliveries" ("client_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "loyalty_notification_deliveries";`)
}
