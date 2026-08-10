import type { Product } from "@/types"

export type CoffeeGroup = "espresso" | "filter" | "drip"

const KNOWN_DRIP_SLUGS = new Set(["rwanda-maraba", "colombia-popayan"])

export const COFFEE_GROUPS: { id: CoffeeGroup; label: string }[] = [
  { id: "espresso", label: "Эспрессо" },
  { id: "filter", label: "Фильтр" },
  { id: "drip", label: "Дрип-кофе" },
]

export function getCoffeeGroup(product: Product): CoffeeGroup {
  if (product.coffee_group) return product.coffee_group
  if (KNOWN_DRIP_SLUGS.has(product.slug) || /(?:дрип|drip)/i.test(product.name)) return "drip"
  if (/^espresso\b/i.test(product.name)) return "espresso"
  return "filter"
}

export function getCoffeeGroupLabel(product: Product): string {
  const group = getCoffeeGroup(product)
  return COFFEE_GROUPS.find((entry) => entry.id === group)?.label || group
}
