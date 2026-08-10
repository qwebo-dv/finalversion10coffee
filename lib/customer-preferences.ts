import { getCoffeeGroupLabel } from "@/lib/coffee-groups"
import type { Order, Product } from "@/types"

export interface CustomerPreferences {
  favoriteGroup: string
  averageAcidity: number | null
  country: string | null
  processingMethod: string | null
  region: string | null
  matchedQuantity: number
}

const PURCHASED_STATUSES = new Set(["paid", "in_production", "ready", "shipped", "delivered"])

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU")
}

function addVote(votes: Map<string, { label: string; weight: number }>, value: string | null, weight: number) {
  if (!value?.trim() || weight <= 0) return
  const key = normalize(value)
  const current = votes.get(key)
  votes.set(key, { label: current?.label || value.trim(), weight: (current?.weight || 0) + weight })
}

function winner(votes: Map<string, { label: string; weight: number }>): string | null {
  return [...votes.values()]
    .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, "ru"))[0]?.label || null
}

export function calculateCustomerPreferences(orders: Order[], products: Product[]): CustomerPreferences | null {
  const productsById = new Map(products.map((product) => [String(product.id), product]))
  const productsByName = new Map(products.map((product) => [normalize(product.name), product]))
  const groupVotes = new Map<string, { label: string; weight: number }>()
  const countryVotes = new Map<string, { label: string; weight: number }>()
  const processingVotes = new Map<string, { label: string; weight: number }>()
  const regionVotes = new Map<string, { label: string; weight: number }>()

  let acidityTotal = 0
  let acidityWeight = 0
  let matchedQuantity = 0

  for (const order of orders) {
    const isPurchased = PURCHASED_STATUSES.has(order.status) || order.payment_status.toLowerCase() === "paid"
    if (!isPurchased || order.status === "cancelled" || order.status === "returned") continue

    for (const item of order.items || []) {
      const quantity = Math.max(0, Number(item.quantity) || 0)
      if (!quantity) continue
      const product = productsById.get(String(item.product_id)) || productsByName.get(normalize(item.product_name || ""))
      if (!product) continue

      matchedQuantity += quantity
      const groupLabel = product.product_type_schema === "coffee"
        ? getCoffeeGroupLabel(product)
        : product.product_type_name
      addVote(groupVotes, groupLabel, quantity)

      if (product.product_type_schema !== "coffee") continue
      addVote(countryVotes, product.country, quantity)
      addVote(processingVotes, product.processing_method, quantity)
      addVote(regionVotes, product.region, quantity)
      if (typeof product.acidity === "number") {
        acidityTotal += product.acidity * quantity
        acidityWeight += quantity
      }
    }
  }

  const favoriteGroup = winner(groupVotes)
  if (!favoriteGroup) return null

  return {
    favoriteGroup,
    averageAcidity: acidityWeight > 0 ? Math.round((acidityTotal / acidityWeight) * 10) / 10 : null,
    country: winner(countryVotes),
    processingMethod: winner(processingVotes),
    region: winner(regionVotes),
    matchedQuantity,
  }
}
