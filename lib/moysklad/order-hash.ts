import { createHash } from "crypto"

export interface OrderContentHashItem {
  productName?: string | null
  variantName?: string | null
  grindOption?: string | null
  quantity?: number | string | null
  unitPrice?: number | string | null
}

export interface OrderContentHashInput {
  subtotal?: number | string | null
  discountAmount?: number | string | null
  deliveryCost?: number | string | null
  total?: number | string | null
  deliveryMethod?: string | null
  deliveryAddress?: string | null
  companyInn?: string | null
  items?: OrderContentHashItem[] | null
}

function numToken(value: unknown): string {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(parsed) : "0"
}

function strToken(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim()
}

/**
 * Stable content hash of an order, derived only from fields that affect the
 * MoySklad document (positions + totals + delivery + company INN). Metadata
 * such as status, payment status or sync fields are intentionally excluded, so
 * the hash changes ONLY when the order itself changes — not when its sync
 * state is updated. Item lines are sorted so ordering differences do not
 * produce a different hash.
 */
export function computeOrderContentHash(order: OrderContentHashInput): string {
  const lines = (order.items || [])
    .map((item) =>
      [
        strToken(item.productName),
        strToken(item.variantName),
        strToken(item.grindOption),
        numToken(item.quantity),
        numToken(item.unitPrice),
      ].join("#")
    )
    .sort()

  const header = [
    numToken(order.subtotal),
    numToken(order.discountAmount),
    numToken(order.deliveryCost),
    numToken(order.total),
    strToken(order.deliveryMethod),
    strToken(order.deliveryAddress),
    strToken(order.companyInn),
  ].join("|")

  const payload = `${header}||${lines.join("~~")}`
  return createHash("sha1").update(payload).digest("hex")
}
