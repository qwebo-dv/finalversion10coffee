import { headers } from "next/headers"
import { getPayload } from "payload"
import configPromise from "@payload-config"
import { canReadOperations, canManageOperations, canRunIntegrations } from "@/payload/access/adminRoles"

export async function requirePayloadAdmin(permission: "readOrders" | "manageOrders" | "integrations") {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const allowed = permission === "integrations" ? canRunIntegrations(user)
    : permission === "manageOrders" ? canManageOperations(user)
      : canReadOperations(user)
  if (!user || !allowed) throw new Error("Нет доступа")
  return { payload, user }
}
