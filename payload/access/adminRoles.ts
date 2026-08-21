import type { Access, PayloadRequest, Where } from "payload"

export type SalesChannel = "wholesale" | "retail"
export type AdminWorkspace = SalesChannel | "all"

export type AdminRole =
  | "admin"
  | "manager"
  | "super_admin"
  | "content_manager"
  | "wholesale_manager"
  | "retail_manager"
  | "support"
  | "integration_operator"

interface AdminUserLike {
  id?: string | number
  collection?: string
  role?: AdminRole | string | null
  canAccessWholesale?: boolean | null
  canAccessRetail?: boolean | null
}

const LEGACY_FULL_ACCESS_ROLES = new Set(["admin", "manager"])
const OPERATIONAL_ROLES = new Set([
  "admin",
  "manager",
  "super_admin",
  "wholesale_manager",
  "retail_manager",
])
const OPERATIONAL_READ_ROLES = new Set([
  ...OPERATIONAL_ROLES,
  "content_manager",
  "support",
  "integration_operator",
])
const CONTENT_ROLES = new Set(["admin", "manager", "super_admin", "content_manager"])
const INTEGRATION_ROLES = new Set(["admin", "manager", "super_admin", "integration_operator"])

export function asAdminUser(user: unknown): AdminUserLike | null {
  if (!user || typeof user !== "object") return null
  const candidate = user as AdminUserLike
  return candidate.collection === "admins" ? candidate : null
}

// Administrators created before roles were introduced have no role value.
// They previously had the operational rights of a manager, so preserve that
// behaviour without granting super-admin-only capabilities.
function effectiveAdminRole(user: unknown): AdminRole | string | null {
  const admin = asAdminUser(user)
  if (!admin) return null
  return admin.role || "manager"
}

export function isSuperAdmin(user: unknown): boolean {
  const role = effectiveAdminRole(user)
  return role === "admin" || role === "super_admin"
}

export function isStaffUser(user: unknown): boolean {
  return Boolean(asAdminUser(user))
}

export function canManageContent(user: unknown): boolean {
  const role = effectiveAdminRole(user)
  return Boolean(role && CONTENT_ROLES.has(role))
}

export function canManageOperations(user: unknown): boolean {
  const role = effectiveAdminRole(user)
  return Boolean(role && OPERATIONAL_ROLES.has(role))
}

export function canReadOperations(user: unknown): boolean {
  const role = effectiveAdminRole(user)
  return Boolean(role && OPERATIONAL_READ_ROLES.has(role))
}

export function canRunIntegrations(user: unknown): boolean {
  const role = effectiveAdminRole(user)
  return Boolean(role && INTEGRATION_ROLES.has(role))
}

export function getAllowedSalesChannels(user: unknown): SalesChannel[] {
  const admin = asAdminUser(user)
  if (!admin) return []
  const role = effectiveAdminRole(admin)
  if (isSuperAdmin(admin) || LEGACY_FULL_ACCESS_ROLES.has(role || "")) {
    return ["wholesale", "retail"]
  }

  // These roles are configured for both workspaces in Admins.beforeValidate.
  // Keep the same access for legacy administrator records created before the
  // workspace flags existed, otherwise Payload returns 403 for relationships
  // such as the client selector in product reviews.
  if (["content_manager", "support", "integration_operator"].includes(role || "")) {
    return ["wholesale", "retail"]
  }

  const channels: SalesChannel[] = []
  if (admin.canAccessWholesale || role === "wholesale_manager") channels.push("wholesale")
  if (admin.canAccessRetail || role === "retail_manager") channels.push("retail")
  return channels
}

export function getWorkspaceWhere(user: unknown, field = "salesChannel"): Where | false {
  if (!canReadOperations(user)) return false
  const channels = getAllowedSalesChannels(user)
  if (channels.length === 2) return {}
  if (channels.length === 0) return false
  return { [field]: { in: channels } }
}

export const staffOnly: Access = ({ req }) => isStaffUser(req.user)
export const superAdminOnly: Access = ({ req }) => isSuperAdmin(req.user)
export const contentManagerOnly: Access = ({ req }) => canManageContent(req.user)

export const operationsReadAccess: Access = ({ req }) => getWorkspaceWhere(req.user)

export const operationsCreateAccess: Access = ({ req }) => canManageOperations(req.user)

export const operationsUpdateAccess: Access = ({ req }) => {
  if (!canManageOperations(req.user)) return false
  return getWorkspaceWhere(req.user)
}

export const operationsDeleteAccess: Access = ({ req }) => isSuperAdmin(req.user)

export function getRequestAdminUser(req: PayloadRequest): AdminUserLike | null {
  return asAdminUser(req.user)
}
