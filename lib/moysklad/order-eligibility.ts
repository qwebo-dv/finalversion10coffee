import type { Where } from "payload"

interface OrderExportState {
  salesChannel?: "retail" | "wholesale" | null
  customerType?: "individual" | "business" | null
  paymentStatus?: string | null
}

// Explicit salesChannel takes precedence, as in the export configuration.
// Force/manual retries must not bypass the retail payment requirement.
export function canExportOrderToMoysklad(order: OrderExportState): boolean {
  const channel = order.salesChannel || (order.customerType === "individual" ? "retail" : "wholesale")
  return channel !== "retail" || order.paymentStatus === "paid"
}

// Filter before pagination so unpaid retail orders cannot fill the retry batch.
export const moyskladExportEligibilityWhere: Where = {
  or: [
    { paymentStatus: { equals: "paid" } },
    { salesChannel: { equals: "wholesale" } },
    { and: [
      { salesChannel: { exists: false } },
      { or: [{ customerType: { exists: false } }, { customerType: { not_equals: "individual" } }] },
    ] },
  ],
}
