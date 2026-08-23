import { dbQuery } from "../lib/db"
import { preparePayloadRuntime } from "./payload-runtime"
import type { BasePayload } from "payload"

type CleanupCollection = "orders" | "clients" | "products" | "categories" | "product-types"

async function getPayloadClient() {
  preparePayloadRuntime()
  const [{ getPayload }, configModule] = await Promise.all([
    import("payload"),
    import("../payload.config"),
  ])
  return getPayload({ config: configModule.default })
}

async function deleteCollection(payload: BasePayload, collection: CleanupCollection) {
  let deleted = 0

  while (true) {
    const result = await payload.find({
      collection,
      limit: 100,
      depth: 0,
    })

    if (result.docs.length === 0) break

    for (const doc of result.docs as { id: string | number }[]) {
      await payload.delete({
        collection,
        id: doc.id,
      })
      deleted += 1
    }
  }

  return deleted
}

async function tableExists(table: string) {
  const { rows } = await dbQuery<{ exists: boolean }>(
    "select to_regclass($1) is not null as exists",
    [table]
  )
  return rows[0]?.exists === true
}

async function truncateIfExists(table: string) {
  if (!(await tableExists(table))) return false
  await dbQuery(`truncate table ${table} restart identity cascade`)
  return true
}

async function cleanupClientAuth() {
  const hasUsers = await tableExists("auth.users")
  if (!hasUsers) return { sessions: false, profiles: false, users: false }

  const clientUsersFilter = "select id from auth.users where coalesce(raw_user_meta_data->>'user_type', '') = 'client'"
  const sessions = await tableExists("public.auth_sessions")
  const profiles = await tableExists("public.client_profiles")

  if (sessions) {
    await dbQuery(`delete from public.auth_sessions where user_id in (${clientUsersFilter})`)
  }

  if (profiles) {
    await dbQuery(`delete from public.client_profiles where id in (${clientUsersFilter})`)
  }

  await dbQuery(`delete from auth.users where id in (${clientUsersFilter})`)

  return { sessions, profiles, users: true }
}

async function main() {
  const payload = await getPayloadClient()

  const rawTables = [
    "public.notifications",
    "public.promo_code_usages",
    "public.cart_items",
    "public.favorites",
    "public.order_items",
    "public.companies",
  ]

  const truncated: string[] = []
  for (const table of rawTables) {
    if (await truncateIfExists(table)) truncated.push(table)
  }

  const deleted = {
    orders: await deleteCollection(payload, "orders"),
    clients: await deleteCollection(payload, "clients"),
    products: await deleteCollection(payload, "products"),
    categories: await deleteCollection(payload, "categories"),
    productTypes: await deleteCollection(payload, "product-types"),
  }

  const auth = await cleanupClientAuth()

  console.log(JSON.stringify({ ok: true, truncated, deleted, auth }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
