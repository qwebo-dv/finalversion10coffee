import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Repairs databases that applied the loyalty migration before Payload's
 * technical lock relation for the collection was present.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "loyalty_operations_id" integer;

    INSERT INTO "loyalty_settings_tiers" ("_order", "_parent_id", "id", "min_subtotal", "percent")
    SELECT tier."order", settings."id", tier."id", tier."min_subtotal", tier."percent"
    FROM "loyalty_settings" settings
    CROSS JOIN (VALUES
      (0, 'loyalty-tier-3', 0, 3),
      (1, 'loyalty-tier-5', 1000, 5),
      (2, 'loyalty-tier-12', 5000, 12)
    ) AS tier("order", "id", "min_subtotal", "percent")
    WHERE NOT EXISTS (SELECT 1 FROM "loyalty_settings_tiers" existing WHERE existing."_parent_id" = settings."id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "loyalty_operations_id";
  `)
}
