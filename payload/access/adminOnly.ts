import type { Access } from "payload"
import { superAdminOnly } from "./adminRoles"

/** Payload is configured with the admins collection as its auth collection. */
export const adminOnly: Access = superAdminOnly
