import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.products_rels
      ADD COLUMN IF NOT EXISTS coffee_brewing_guides_id integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'products_rels_coffee_brewing_guides_fk'
      ) THEN
        ALTER TABLE public.products_rels
          ADD CONSTRAINT products_rels_coffee_brewing_guides_fk
          FOREIGN KEY (coffee_brewing_guides_id)
          REFERENCES public.coffee_brewing_guides(id)
          ON DELETE cascade
          ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS products_rels_coffee_brewing_guides_id_idx
      ON public.products_rels USING btree (coffee_brewing_guides_id);

    INSERT INTO public.products_rels ("order", parent_id, path, coffee_brewing_guides_id)
    SELECT legacy._order, legacy._parent_id, 'coffeeDetails.brewingMethods', guide.id
    FROM public.products_coffee_details_brewing_methods legacy
    JOIN public.coffee_brewing_guides guide
      ON lower(trim(guide.title)) = lower(trim(legacy.method))
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.products_rels existing
      WHERE existing.parent_id = legacy._parent_id
        AND existing.path = 'coffeeDetails.brewingMethods'
        AND existing.coffee_brewing_guides_id = guide.id
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM public.products_rels
      WHERE path = 'coffeeDetails.brewingMethods';
    ALTER TABLE public.products_rels
      DROP CONSTRAINT IF EXISTS products_rels_coffee_brewing_guides_fk;
    DROP INDEX IF EXISTS public.products_rels_coffee_brewing_guides_id_idx;
    ALTER TABLE public.products_rels
      DROP COLUMN IF EXISTS coffee_brewing_guides_id;
  `)
}
