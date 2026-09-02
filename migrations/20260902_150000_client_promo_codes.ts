import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.clients_rels
      ADD COLUMN IF NOT EXISTS promo_codes_id integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'clients_rels_promo_codes_fk'
      ) THEN
        ALTER TABLE public.clients_rels
          ADD CONSTRAINT clients_rels_promo_codes_fk
          FOREIGN KEY (promo_codes_id)
          REFERENCES public.promo_codes(id)
          ON DELETE cascade
          ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS clients_rels_promo_codes_id_idx
      ON public.clients_rels USING btree (promo_codes_id);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.clients_rels
      DROP CONSTRAINT IF EXISTS clients_rels_promo_codes_fk;
    DROP INDEX IF EXISTS public.clients_rels_promo_codes_id_idx;
    ALTER TABLE public.clients_rels
      DROP COLUMN IF EXISTS promo_codes_id;
  `)
}
