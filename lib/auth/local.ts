import { cookies } from "next/headers"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { dbQuery } from "@/lib/db"
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants"
import type { AppUser } from "@/lib/auth/types"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

interface UserRow {
  id: string
  email: string | null
  encrypted_password: string | null
  raw_user_meta_data: Record<string, unknown> | null
  raw_app_meta_data: Record<string, unknown> | null
}

let schemaPromise: Promise<void> | null = null

export function generatePassword(length = 12): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
  return Array.from(crypto.randomBytes(length))
    .map((byte) => chars[byte % chars.length])
    .join("")
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function toUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email || "",
    user_metadata: row.raw_user_meta_data || {},
    app_metadata: row.raw_app_meta_data || {},
  }
}

export function shouldUseSecureCookies() {
  const explicit = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase()
  if (explicit === "true") return true
  if (explicit === "false") return false

  return [
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.COOLIFY_URL,
  ].some((url) => url?.trim().startsWith("https://"))
}

function cookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge,
  }
}

export async function ensureLocalAuthSchema() {
  if (!schemaPromise) {
    schemaPromise = dbQuery(`
      create table if not exists public.auth_sessions (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null,
        token_hash text not null unique,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      );
      create index if not exists auth_sessions_user_id_idx on public.auth_sessions(user_id);
      create index if not exists auth_sessions_expires_at_idx on public.auth_sessions(expires_at);
    `).then(() => undefined)
  }

  return schemaPromise
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const { rows } = await dbQuery<UserRow>(
    `select id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data
       from auth.users
      where id = $1 and deleted_at is null
      limit 1`,
    [id]
  )
  return rows[0] ? toUser(rows[0]) : null
}

export async function getUserByEmail(email: string): Promise<(AppUser & { encryptedPassword: string | null }) | null> {
  const { rows } = await dbQuery<UserRow>(
    `select id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data
       from auth.users
      where lower(email) = lower($1) and deleted_at is null
      limit 1`,
    [email]
  )

  if (!rows[0]) return null
  return { ...toUser(rows[0]), encryptedPassword: rows[0].encrypted_password }
}

export async function verifyPassword(email: string, password: string) {
  const user = await getUserByEmail(email)
  if (!user?.encryptedPassword) return null

  const ok = await bcrypt.compare(password, user.encryptedPassword)
  return ok ? user : null
}

export async function createAuthUser(params: {
  email: string
  password: string
  metadata: Record<string, unknown>
}): Promise<AppUser> {
  const existing = await getUserByEmail(params.email)
  if (existing) {
    throw new Error("User already exists")
  }

  const id = crypto.randomUUID()
  const encryptedPassword = await bcrypt.hash(params.password, 10)
  const { rows } = await dbQuery<UserRow>(
    `insert into auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        is_sso_user,
        is_anonymous
      )
      values ($1, 'authenticated', 'authenticated', $2, $3, now(), $4::jsonb, $5::jsonb, now(), now(), false, false)
      returning id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data`,
    [
      id,
      params.email,
      encryptedPassword,
      JSON.stringify({ provider: "email", providers: ["email"] }),
      JSON.stringify(params.metadata),
    ]
  )

  return toUser(rows[0])
}

export async function upsertAuthUser(params: {
  email: string
  password: string
  metadata: Record<string, unknown>
}): Promise<{ user: AppUser; created: boolean }> {
  const existing = await getUserByEmail(params.email)
  if (existing) {
    return { user: existing, created: false }
  }

  const user = await createAuthUser(params)
  return { user, created: true }
}

export async function updateAuthUser(
  id: string,
  params: { password?: string; metadata?: Record<string, unknown> }
) {
  const sets: string[] = ["updated_at = now()"]
  const values: unknown[] = []

  if (params.password) {
    values.push(await bcrypt.hash(params.password, 10))
    sets.push(`encrypted_password = $${values.length}`)
  }

  if (params.metadata) {
    values.push(JSON.stringify(params.metadata))
    sets.push(`raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || $${values.length}::jsonb`)
  }

  values.push(id)
  const { rows } = await dbQuery<UserRow>(
    `update auth.users
        set ${sets.join(", ")}
      where id = $${values.length}
      returning id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data`,
    values
  )

  return rows[0] ? toUser(rows[0]) : null
}

export async function listAuthUsers() {
  const { rows } = await dbQuery<UserRow>(
    `select id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data
       from auth.users
      where deleted_at is null
      order by created_at desc`
  )

  return rows.map(toUser)
}

export async function createSession(userId: string) {
  await ensureLocalAuthSchema()

  const token = crypto.randomBytes(32).toString("base64url")
  await dbQuery(
    `insert into public.auth_sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [userId, hashToken(token), SESSION_TTL_SECONDS]
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions())
}

export async function destroyCurrentSession() {
  await ensureLocalAuthSchema()

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await dbQuery("delete from public.auth_sessions where token_hash = $1", [hashToken(token)])
  }
  cookieStore.set(SESSION_COOKIE_NAME, "", cookieOptions(0))
}

export async function getCurrentUser(): Promise<AppUser | null> {
  await ensureLocalAuthSchema()

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const { rows } = await dbQuery<UserRow>(
    `select u.id, u.email, u.encrypted_password, u.raw_user_meta_data, u.raw_app_meta_data
       from public.auth_sessions s
       join auth.users u on u.id = s.user_id
      where s.token_hash = $1
        and s.expires_at > now()
        and u.deleted_at is null
      limit 1`,
    [hashToken(token)]
  )

  return rows[0] ? toUser(rows[0]) : null
}
