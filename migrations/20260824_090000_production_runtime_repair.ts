import { sql } from "@payloadcms/db-postgres"
import type { MigrateUpArgs } from "@payloadcms/db-postgres"

/**
 * Final idempotent repair for production databases that stopped midway through
 * the 2026-08 loyalty/YooKassa/job-applications migration batch.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS public.payload_locked_documents_rels
      ADD COLUMN IF NOT EXISTS loyalty_operations_id integer,
      ADD COLUMN IF NOT EXISTS job_applications_id integer,
      ADD COLUMN IF NOT EXISTS job_application_files_id integer;

    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_loyalty_operations_id_idx
      ON public.payload_locked_documents_rels (loyalty_operations_id);
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_job_applications_id_idx
      ON public.payload_locked_documents_rels (job_applications_id);
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_job_application_files_id_idx
      ON public.payload_locked_documents_rels (job_application_files_id);

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

      IF enum_name IS NOT NULL THEN
        FOREACH enum_value IN ARRAY ARRAY[
          'pending', 'invoiced', 'partial', 'paid', 'refunded', 'cancelled', 'failed'
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
  // This is a non-destructive repair. Removing columns or enum values could
  // invalidate existing Payload locks and orders, so rollback is intentionally
  // a no-op.
}
