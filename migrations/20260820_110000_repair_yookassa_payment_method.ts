import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * The retail checkout has used YooKassa since the payment settings migration,
 * but existing databases may still have the earlier payment-method enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      enum_schema text;
      enum_name text;
    BEGIN
      SELECT namespace.nspname, value_type.typname
        INTO enum_schema, enum_name
        FROM pg_attribute column_definition
        JOIN pg_class table_definition
          ON table_definition.oid = column_definition.attrelid
        JOIN pg_namespace table_namespace
          ON table_namespace.oid = table_definition.relnamespace
        JOIN pg_type value_type
          ON value_type.oid = column_definition.atttypid
        JOIN pg_namespace namespace
          ON namespace.oid = value_type.typnamespace
       WHERE table_namespace.nspname = 'public'
         AND table_definition.relname = 'orders'
         AND column_definition.attname = 'payment_method'
         AND column_definition.attnum > 0
         AND NOT column_definition.attisdropped
         AND value_type.typtype = 'e'
       LIMIT 1;

      -- Older production databases store payment_method as varchar, where the
      -- YooKassa value needs no schema change. Fresher Payload schemas use an
      -- enum whose generated name is not guaranteed to be identical.
      IF enum_name IS NOT NULL THEN
        EXECUTE format(
          'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
          enum_schema,
          enum_name,
          'yookassa'
        );
      END IF;
    END $$;
  `)
}

export async function down(): Promise<void> {
  // PostgreSQL enum values cannot be removed safely in a reversible migration.
}
