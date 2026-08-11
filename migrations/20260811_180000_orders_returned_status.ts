import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // The Payload collection already exposes this value. Some production
  // databases were created before it was added to the generated schema.
  await db.execute(sql`
    ALTER TYPE "enum_orders_status"
      ADD VALUE IF NOT EXISTS 'returned' BEFORE 'cancelled';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  void _args
  // PostgreSQL cannot remove a single enum value safely without recreating the
  // type and rewriting its column. Keeping the value is the safe rollback.
}
