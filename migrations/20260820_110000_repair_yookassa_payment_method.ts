import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * The retail checkout has used YooKassa since the payment settings migration,
 * but existing databases may still have the earlier payment-method enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_orders_payment_method" ADD VALUE IF NOT EXISTS 'yookassa';
  `)
}

export async function down(): Promise<void> {
  // PostgreSQL enum values cannot be removed safely in a reversible migration.
}
