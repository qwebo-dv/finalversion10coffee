import type { OrderStatus, DeliveryMethod } from "@/types"

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Ожидает обработки",
  confirmed: "Подтверждён",
  invoiced: "Счёт выставлен",
  paid: "Оплачен",
  in_production: "В производстве",
  ready: "Собран",
  shipped: "Отгружен",
  delivered: "Доставлен",
  returned: "Возврат",
  cancelled: "Отменён",
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  invoiced: "bg-indigo-100 text-indigo-800",
  paid: "bg-green-100 text-green-800",
  in_production: "bg-orange-100 text-orange-800",
  ready: "bg-emerald-100 text-emerald-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-200 text-green-900",
  returned: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
}

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  self_pickup: "Самовывоз",
  cdek: "СДЭК",
  cap_2000: "ЦАП 2000",
  sochi_delivery: "Доставка по Сочи",
  yandex_delivery: "Яндекс Доставка",
}

export function getTagBgClass(color?: string): string {
  if (color === "purple") return "bg-[#faead5] text-[#5b328a]"
  if (color === "green") return "bg-green-100 text-green-700"
  if (color === "red") return "bg-red-100 text-red-700"
  if (color === "blue") return "bg-blue-100 text-blue-700"
  if (color === "yellow") return "bg-yellow-100 text-yellow-800"
  if (color === "pink") return "bg-pink-100 text-pink-700"
  if (color === "gray") return "bg-neutral-100 text-neutral-600"
  if (color?.startsWith("#")) return "text-white"
  return "bg-[#faead5] text-[#e6610d]"
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) return null
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
}

function lighten(hex: string, factor: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const r = Math.round(rgb.r + (255 - rgb.r) * factor)
  const g = Math.round(rgb.g + (255 - rgb.g) * factor)
  const b = Math.round(rgb.b + (255 - rgb.b) * factor)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}


export function getTagStyle(color?: string): Record<string, string> | undefined {
  if (!color?.startsWith("#")) return undefined
  return { backgroundColor: lighten(color, 0.85), color }
}

export const PRODUCT_TYPE_LABELS = {
  coffee: "Кофе",
  tea: "Чай",
  accessory: "Аксессуары",
} as const

export const GRIND_OPTIONS = ["В зёрнах", "Молотый"] as const

export const SELF_PICKUP_ADDRESS = "г. Сочи, ул. Пластунская 79/1, пом. 1"

export const TRAINING_URL = "https://www.10coffee.ru/obuchenie"
