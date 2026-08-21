import { sql } from "@payloadcms/db-postgres"
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.auth_social_identities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      provider text NOT NULL CHECK (provider IN ('yandex', 'vk', 'telegram')),
      provider_user_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_user_id),
      UNIQUE (user_id, provider)
    );

    CREATE INDEX IF NOT EXISTS auth_social_identities_user_id_idx
      ON public.auth_social_identities (user_id);

    -- Existing Telegram users used a generated technical email. Its embedded
    -- Telegram subject is stable, so preserve it as the first linked identity.
    INSERT INTO public.auth_social_identities (user_id, provider, provider_user_id)
    SELECT
      id,
      'telegram',
      substring(email FROM '^telegram-(.+)@auth\\.10coffee\\.local$')
    FROM auth.users
    WHERE email ~ '^telegram-.+@auth\\.10coffee\\.local$'
      AND deleted_at IS NULL
    ON CONFLICT (provider, provider_user_id) DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS public.auth_social_identities;
  `)
}
