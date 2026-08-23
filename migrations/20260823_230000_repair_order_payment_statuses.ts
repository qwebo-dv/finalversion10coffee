import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Older databases were created before the terminal YooKassa statuses were
 * added to the Payload collection. Resolve the actual enum attached to the
 * column because Payload's generated enum name can differ between databases.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      enum_schema text;
      enum_name text;
      enum_value text;
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
         AND column_definition.attname = 'payment_status'
         AND column_definition.attnum > 0
         AND NOT column_definition.attisdropped
         AND value_type.typtype = 'e'
       LIMIT 1;

      -- A varchar-backed legacy column already accepts these values. For enum
      -- columns, add every status used by the current Payload configuration.
      IF enum_name IS NOT NULL THEN
        FOREACH enum_value IN ARRAY ARRAY[
          'pending',
          'invoiced',
          'partial',
          'paid',
          'refunded',
          'cancelled',
          'failed'
        ]
        LOOP
          EXECUTE format(
            'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
            enum_schema,
            enum_name,
            enum_value
          );
        END LOOP;
      END IF;
    END $$;
  `)
}

export async function down(): Promise<void> {
  // PostgreSQL enum values cannot be removed safely in a reversible migration.
}
