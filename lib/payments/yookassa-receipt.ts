export type YooKassaVatCode = 1 | 2 | 3 | 4 | 7 | 8 | 11

export interface YooKassaReceiptItem {
  description: string
  amountRubles: number
  vatCode: YooKassaVatCode
  paymentSubject: "commodity" | "service"
}

interface OrderReceiptLine {
  productName?: string | null
  variantName?: string | null
  quantity?: number | null
  totalPrice?: number | null
}

const VAT_CODES: Record<string, YooKassaVatCode> = {
  "0": 2,
  "5": 7,
  "7": 8,
  "10": 3,
  "20": 4,
  "22": 11,
}

export function resolveYooKassaVatCode(vatRate?: string | null, vatCustomRate?: number | string | null): YooKassaVatCode {
  if (!vatRate || vatRate === "none") return 1
  const rate = vatRate === "custom" ? Number(vatCustomRate) : Number(vatRate)
  return VAT_CODES[String(rate)] || 1
}

function receiptDescription(line: OrderReceiptLine) {
  const name = line.productName?.trim() || "Товар"
  const variant = line.variantName?.trim()
  const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1))
  return [name, variant, quantity > 1 ? `× ${quantity} шт.` : null]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 128)
}

export function buildYooKassaReceiptItems(params: {
  items?: OrderReceiptLine[] | null
  discountAmount?: number | null
  deliveryCost?: number | null
  vatRate?: string | null
  vatCustomRate?: number | string | null
}): YooKassaReceiptItem[] {
  const vatCode = resolveYooKassaVatCode(params.vatRate, params.vatCustomRate)
  const source = (params.items || []).map((line) => ({
    line,
    totalKopecks: Math.max(0, Math.round((Number(line.totalPrice) || 0) * 100)),
  }))
  const subtotalKopecks = source.reduce((sum, line) => sum + line.totalKopecks, 0)
  const discountKopecks = Math.min(
    subtotalKopecks,
    Math.max(0, Math.round((Number(params.discountAmount) || 0) * 100)),
  )

  const exactDiscounts = source.map(({ totalKopecks }) =>
    subtotalKopecks > 0 ? totalKopecks * discountKopecks / subtotalKopecks : 0,
  )
  const allocatedDiscounts = exactDiscounts.map(Math.floor)
  let remainder = discountKopecks - allocatedDiscounts.reduce((sum, amount) => sum + amount, 0)
  const allocationOrder = exactDiscounts
    .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
  for (const entry of allocationOrder) {
    if (remainder <= 0) break
    allocatedDiscounts[entry.index] += 1
    remainder -= 1
  }

  const receiptItems: YooKassaReceiptItem[] = source.flatMap(({ line, totalKopecks }, index) => {
    const amountKopecks = totalKopecks - allocatedDiscounts[index]
    if (amountKopecks <= 0) return []
    return [{
      description: receiptDescription(line),
      amountRubles: amountKopecks / 100,
      vatCode,
      paymentSubject: "commodity" as const,
    }]
  })

  const deliveryKopecks = Math.max(0, Math.round((Number(params.deliveryCost) || 0) * 100))
  if (deliveryKopecks > 0) {
    receiptItems.push({
      description: "Доставка заказа",
      amountRubles: deliveryKopecks / 100,
      vatCode,
      paymentSubject: "service",
    })
  }

  return receiptItems
}
