import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

/**
 * Adds structured retail coffee profiles and backfills only values confirmed
 * by the July 10 Coffee price list. Existing editorial values always win.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS coffee_details_taste_description varchar,
      ADD COLUMN IF NOT EXISTS coffee_details_acidity numeric,
      ADD COLUMN IF NOT EXISTS coffee_details_brew_group varchar;

    CREATE INDEX IF NOT EXISTS products_coffee_details_brew_group_idx
      ON public.products USING btree (coffee_details_brew_group);

    UPDATE public.products
      SET coffee_details_brew_group = CASE
        WHEN slug IN (
          'espresso-back-to-black',
          'espresso-blend-1',
          'espresso-blend-sweeter',
          'espresso-brasil',
          'espresso-colombia',
          'espresso-ethiopia',
          'espresso-ethiopia-jimma',
          'espresso-honduras'
        ) THEN 'espresso'
        WHEN slug IN ('rwanda-maraba', 'colombia-popayan') THEN 'drip'
        ELSE 'filter'
      END
      WHERE details_schema = 'coffee'
        AND coffee_details_brew_group IS NULL;

    UPDATE public.products
      SET
        coffee_details_taste_description = COALESCE(
          coffee_details_taste_description,
          CASE slug
            WHEN 'espresso-brasil' THEN 'Темный шоколад, марципан, карамель'
            WHEN 'espresso-back-to-black' THEN 'Горький шоколад, фундук, карамель'
            WHEN 'espresso-blend-sweeter' THEN 'Красные ягоды, абрикос, бразильский орех'
            WHEN 'espresso-blend-1' THEN 'Какао, орехи, карамель, шоколад'
            WHEN 'espresso-ethiopia-jimma' THEN 'Цветы, яблоко, гвоздика'
            WHEN 'espresso-colombia' THEN 'Помело, апельсин, шоколад'
            WHEN 'espresso-ethiopia' THEN 'Цитрусы, шоколад, орехи'
            WHEN 'espresso-honduras' THEN 'Цитрусы, шоколад, орехи'
            WHEN 'kenya-moigitu' THEN 'Черная смородина, чай, рябина, клюква, цукаты'
            WHEN 'colombia-risaralda' THEN 'Мед, ваниль, миндаль, цитрусы, какао'
            WHEN 'ethiopia-guji-acacia' THEN 'Тропические фрукты, чай, цветы, малина'
            WHEN 'colombia-ruiz' THEN 'Желтая слива, ягоды, мармелад, молочный шоколад, цитрусы'
            WHEN 'ethiopia-guji-edera' THEN 'Варенье, орехи, сочные фрукты, темные ягоды, темный шоколад, цитрусы'
            WHEN 'rwanda-maraba' THEN 'Красные ягоды, апельсин, черный чай, жасмин'
            WHEN 'colombia-popayan' THEN 'Красные ягоды, помело, шоколад, кешью'
            ELSE NULL
          END
        ),
        coffee_details_acidity = COALESCE(
          coffee_details_acidity,
          CASE slug
            WHEN 'espresso-brasil' THEN 4
            WHEN 'espresso-back-to-black' THEN 3
            WHEN 'espresso-blend-sweeter' THEN 4
            WHEN 'espresso-blend-1' THEN 2
            WHEN 'espresso-ethiopia-jimma' THEN 3
            WHEN 'espresso-colombia' THEN 5
            WHEN 'espresso-ethiopia' THEN 4
            WHEN 'espresso-honduras' THEN 3
            ELSE NULL
          END
        )
      WHERE details_schema = 'coffee';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Preserve the editorial data on rollback; only the optional index is removed.
  await db.execute(sql`
    DROP INDEX IF EXISTS public.products_coffee_details_brew_group_idx;
  `)
}
