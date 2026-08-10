export interface OrderDiscountItem {
  totalPrice?: number | string | null
}

export interface OrderLineDiscount {
  discountPercent: number
  discountAmount: number
}

export function normalizeOrderDiscountPercent(value: unknown): number {
  const percent = Number(value)
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}

/**
 * Spreads an order-level percentage across its positions while keeping the
 * sum of the line discounts exactly equal to the order discount.
 */
export function calculateOrderLineDiscounts(
  items: OrderDiscountItem[],
  value: unknown,
): OrderLineDiscount[] {
  const discountPercent = normalizeOrderDiscountPercent(value)
  const totals = items.map((item) => Math.max(0, Number(item.totalPrice) || 0))
  const subtotal = totals.reduce((sum, total) => sum + total, 0)
  const targetAmount = Math.round((subtotal * discountPercent) / 100)
  const exactAmounts = totals.map((total) => (total * discountPercent) / 100)
  const amounts = exactAmounts.map(Math.floor)
  const remainder = targetAmount - amounts.reduce((sum, amount) => sum + amount, 0)

  // Largest-remainder allocation avoids putting the entire rounding delta on
  // the last position and guarantees that line amounts add up to the header.
  const remainderOrder = exactAmounts
    .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (let index = 0; index < remainder && index < remainderOrder.length; index += 1) {
    amounts[remainderOrder[index].index] += 1
  }

  return amounts.map((discountAmount) => ({ discountPercent, discountAmount }))
}
