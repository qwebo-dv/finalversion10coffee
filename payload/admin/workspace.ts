import type { PayloadRequest, Where } from "payload"
import {
  getAllowedSalesChannels,
  type AdminWorkspace,
  type SalesChannel,
} from "../access/adminRoles"

export const ADMIN_WORKSPACE_COOKIE = "coffee_admin_workspace"

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=")
    if (rawName === name) return decodeURIComponent(rawValue.join("="))
  }
  return null
}

export function resolveAdminWorkspace(req: PayloadRequest): AdminWorkspace {
  const allowed = getAllowedSalesChannels(req.user)
  const requested = readCookie(req.headers.get("cookie"), ADMIN_WORKSPACE_COOKIE)

  if (requested === "all" && allowed.length === 2) return "all"
  if ((requested === "wholesale" || requested === "retail") && allowed.includes(requested)) {
    return requested
  }
  if (allowed.length === 2) return "all"
  return allowed[0] || "all"
}

export function workspaceToSalesChannel(workspace: AdminWorkspace): SalesChannel | null {
  return workspace === "all" ? null : workspace
}

export async function workspaceBaseFilter({ req }: { req: PayloadRequest }): Promise<Where | null> {
  const workspace = resolveAdminWorkspace(req)
  const salesChannel = workspaceToSalesChannel(workspace)
  return salesChannel ? { salesChannel: { equals: salesChannel } } : null
}

export async function retailOnlyBaseFilter({ req }: { req: PayloadRequest }): Promise<Where | null> {
  return resolveAdminWorkspace(req) === "wholesale" ? { id: { equals: -1 } } : null
}

export async function wholesaleOnlyBaseFilter({ req }: { req: PayloadRequest }): Promise<Where | null> {
  return resolveAdminWorkspace(req) === "retail" ? { id: { equals: -1 } } : null
}

export async function promoWorkspaceBaseFilter({ req }: { req: PayloadRequest }): Promise<Where | null> {
  const workspace = resolveAdminWorkspace(req)
  if (workspace === "retail") return { audience: { in: ["individual", "all"] } }
  if (workspace === "wholesale") return { audience: { in: ["business", "all"] } }
  return null
}
