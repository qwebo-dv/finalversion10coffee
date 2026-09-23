import type { MoyskladOrderPositionPayload } from "./types"

export interface MoyskladDiscountLine {
  cartItemId: string
  discountPercent: number
  discountAmount?: number
}

export function moyskladPositionsSum(positions: MoyskladOrderPositionPayload[]) {
  return positions.reduce((sum, p) => sum + Math.round(p.price * p.quantity * (1 - (p.discount || 0) / 100)), 0)
}

/** Preserve the site's saved totals and explicit percentage on one row per item.
 * MoySklad price is a Float in kopecks. Adjust only the price of a row whose
 * percentage disagrees with the site's rounded discount; never replace the
 * discount with zero or split quantities to distribute the rounding remainder.
 */
export function reconcileMoyskladOrderTotals(
  positions: MoyskladOrderPositionPayload[],
  itemIds: string[],
  discounts: MoyskladDiscountLine[],
  expectedTotal?: number,
  expectedSubtotal?: number,
) {
  const discountsByItem = new Map(discounts.map(line => [line.cartItemId, line]))
  const targets = positions.map((position, index) => {
    if (!Number.isSafeInteger(position.price) || position.price < 0 ||
        !Number.isSafeInteger(position.quantity) || position.quantity <= 0) {
      throw new Error("Некорректная цена или количество позиции для выгрузки в МойСклад")
    }
    const gross = position.price * position.quantity
    if (!Number.isSafeInteger(gross)) throw new Error("Сумма позиции превышает допустимый диапазон")
    const line = discountsByItem.get(itemIds[index])
    if (!line || !((position.discount || 0) > 0)) return gross
    // Old orders can have a percentage but a default zero amount.
    const amount = line.discountAmount != null && line.discountAmount > 0
      ? Math.round(line.discountAmount * 100)
      : Math.round(gross * (position.discount || 0) / 10000) * 100
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > gross) {
      throw new Error("Скидка позиции не соответствует её сумме")
    }
    return gross - amount
  })

  const grossItems = positions.slice(0, itemIds.length).reduce((sum, p) => sum + p.quantity * p.price, 0)
  if (expectedSubtotal !== undefined && (!Number.isFinite(expectedSubtotal) || expectedSubtotal < 0 ||
      grossItems !== Math.round(expectedSubtotal * 100))) {
    throw new Error("Товары или цены не соответствуют сохранённому подытогу заказа; требуется сверка")
  }

  if (expectedTotal !== undefined) {
    const expected = Math.round(expectedTotal * 100)
    if (!Number.isFinite(expectedTotal) || expectedTotal < 0 || !Number.isSafeInteger(expected)) {
      throw new Error("Некорректная итоговая сумма заказа")
    }
    let remainder = expected - targets.reduce((sum, value) => sum + value, 0)
    const eligible = positions.map((p, i) => (p.discount || 0) > 0 && i < itemIds.length ? i : -1).filter(i => i >= 0)
    // A document-level discount may be rounded once instead of per line.
    // Reconcile that rounding only; never hide missing items or changed prices.
    if (Math.abs(remainder) > eligible.length * 50) {
      throw new Error("Суммы позиций и скидок не совпадают с сохранённым итогом заказа; требуется сверка")
    }
    for (const index of eligible) {
      const gross = positions[index].price * positions[index].quantity
      const adjustment = Math.max(-targets[index], Math.min(gross - targets[index], remainder))
      targets[index] += adjustment
      remainder -= adjustment
      if (remainder === 0) break
    }
    if (remainder !== 0) throw new Error("Не удалось согласовать округление скидки с итогом заказа")
  }

  const result = positions.map((position, index) => {
    const target = targets[index]
    if (moyskladPositionsSum([position]) === target) return { ...position }
    const multiplier = 1 - (position.discount || 0) / 100
    if (!(multiplier > 0 && multiplier <= 1)) {
      throw new Error("Не удалось согласовать сумму позиции с её процентом скидки")
    }
    const exactPrice = target / position.quantity / multiplier
    // Use the least decimal precision that reproduces the saved line total.
    // The response total is checked separately against the real API result.
    for (let precision = 0; precision <= 6; precision++) {
      const candidate = { ...position, price: Number(exactPrice.toFixed(precision)) }
      if (Number.isFinite(candidate.price) && candidate.price >= 0 &&
          moyskladPositionsSum([candidate]) === target) return candidate
    }
    throw new Error("Не удалось согласовать округление цены без разделения позиции; требуется сверка")
  })
  if (moyskladPositionsSum(result) !== targets.reduce((sum, value) => sum + value, 0)) {
    throw new Error("Ошибка проверки итоговой суммы перед отправкой в МойСклад")
  }
  return result
}

export function assertMoyskladDocumentTotal(document: { sum?: number } | null, expectedTotal?: number) {
  if (expectedTotal === undefined) return
  if (!document || !Number.isFinite(document.sum) || Math.round(document.sum!) !== Math.round(expectedTotal * 100)) {
    throw new Error("МойСклад вернул сумму, отличающуюся от итога сайта; документ сохранён для сверки")
  }
}
