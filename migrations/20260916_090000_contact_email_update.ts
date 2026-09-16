import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "faqs"
       SET answer = REPLACE(answer, '10coffee@mail.ru', 'info@10coffee.ru'),
           updated_at = now()
     WHERE answer LIKE '%10coffee@mail.ru%';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "faqs"
       SET answer = REPLACE(answer, 'info@10coffee.ru', '10coffee@mail.ru'),
           updated_at = now()
     WHERE answer LIKE '%info@10coffee.ru%';
  `)
}