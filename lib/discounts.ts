import type { CartItem } from "@/types"

export interface CategoryDiscountRule {
  categoryId: string
  categoryName?: string
  discountPercent: number
}

export interface ProductDiscountRule {
  productId: string
  productName?: string
  discountPercent: number
}

export interface ClientDiscountConfig {
  discountPercent: number
  categoryDiscounts: CategoryDiscountRule[]
  productDiscounts?: ProductDiscountRule[]
}

export interface ClientDiscountLine {
  cartItemId: string
  categoryId: string
  categoryName?: string
  productId: string
  productName?: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  source: "product" | "category" | "base"
}

export interface ClientDiscountResult {
  amount: number
  label: string
  lines: ClientDiscountLine[]
  hasCategoryDiscount: boolean
  hasProductDiscount: boolean
  hasBaseDiscount: boolean
}

export const EMPTY_CLIENT_DISCOUNT_CONFIG: ClientDiscountConfig = {
  discountPercent: 0,
  categoryDiscounts: [],
  productDiscounts: [],
}

export function normalizeDiscountPercent(value: unknown): number {
  const percent = Number(value) || 0
  return Math.max(0, Math.min(100, percent))
}

export function normalizeCategoryDiscounts(rules: CategoryDiscountRule[]): CategoryDiscountRule[] {
  const byCategory = new Map<string, CategoryDiscountRule>()

  for (const rule of rules) {
    const categoryId = String(rule.categoryId || "")
    const discountPercent = normalizeDiscountPercent(rule.discountPercent)
    if (!categoryId || discountPercent <= 0) continue

    const existing = byCategory.get(categoryId)
    if (!existing || discountPercent >= existing.discountPercent) {
      byCategory.set(categoryId, {
        categoryId,
        categoryName: rule.categoryName,
        discountPercent,
      })
    }
  }

  return Array.from(byCategory.values())
}

export function normalizeProductDiscounts(rules: ProductDiscountRule[]): ProductDiscountRule[] {
  const byProduct = new Map<string, ProductDiscountRule>()

  for (const rule of rules) {
    const productId = String(rule.productId || "")
    const discountPercent = normalizeDiscountPercent(rule.discountPercent)
    if (!productId || discountPercent <= 0) continue

    const existing = byProduct.get(productId)
    if (!existing || discountPercent >= existing.discountPercent) {
      byProduct.set(productId, {
        productId,
        productName: rule.productName,
        discountPercent,
      })
    }
  }

  return Array.from(byProduct.values())
}

export function calculateClientDiscount(
  items: CartItem[],
  config: ClientDiscountConfig
): ClientDiscountResult {
  const basePercent = normalizeDiscountPercent(config.discountPercent)
  const categoryRules = normalizeCategoryDiscounts(config.categoryDiscounts)
  const categoryRuleMap = new Map(categoryRules.map((rule) => [rule.categoryId, rule]))
  const productRules = normalizeProductDiscounts(config.productDiscounts || [])
  const productRuleMap = new Map(productRules.map((rule) => [rule.productId, rule]))
  const lines: ClientDiscountLine[] = []

  for (const item of items) {
    const categoryIds = item.product?.category_ids?.length
      ? item.product.category_ids
      : [item.product?.category_id || ""]
    const categoryId = categoryIds[0] || ""
    const productId = String(item.product_id || item.product?.id || "")
    const subtotal = (item.variant?.price ?? 0) * item.quantity
    const productRule = productRuleMap.get(productId)
    const categoryRule = categoryIds
      .map((id) => categoryRuleMap.get(id))
      .find((rule): rule is CategoryDiscountRule => Boolean(rule))
    const discountPercent = productRule?.discountPercent ?? categoryRule?.discountPercent ?? basePercent
    const source = productRule ? "product" : categoryRule ? "category" : "base"
    const discountAmount = discountPercent > 0
      ? Math.round((subtotal * discountPercent) / 100)
      : 0

    if (discountAmount > 0) {
      lines.push({
        cartItemId: item.id,
        categoryId,
        categoryName: categoryRule?.categoryName,
        productId,
        productName: productRule?.productName || item.product?.name,
        subtotal,
        discountPercent,
        discountAmount,
        source,
      })
    }
  }

  const amount = lines.reduce((sum, line) => sum + line.discountAmount, 0)
  const hasCategoryDiscount = lines.some((line) => line.source === "category")
  const hasProductDiscount = lines.some((line) => line.source === "product")
  const hasBaseDiscount = lines.some((line) => line.source === "base")
  const label = hasProductDiscount
    ? "Скидка на выбранные товары"
    : hasCategoryDiscount
      ? "Скидка по категориям"
    : hasBaseDiscount
      ? `Скидка ${basePercent}%`
      : ""

  return {
    amount,
    label,
    lines,
    hasCategoryDiscount,
    hasProductDiscount,
    hasBaseDiscount,
  }
}
