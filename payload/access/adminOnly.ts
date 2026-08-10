import type { Access } from "payload"

/** Payload is configured with the admins collection as its auth collection. */
export const adminOnly: Access = ({ req }) => req.user?.role === "admin"
