"use server"

import {
  findYandexDeliveryLocations,
  isYandexDeliveryTestMode,
  listYandexDeliveryPickupPoints,
  type YandexDeliveryLocation,
  type YandexDeliveryPickupPoint,
} from "@/lib/yandex-delivery"

type ActionResult<T> = { data: T; error?: never; testMode: boolean } | { data: T; error: string; testMode: boolean }

export async function searchShopYandexDeliveryLocations(query: string): Promise<ActionResult<YandexDeliveryLocation[]>> {
  try {
    return { data: await findYandexDeliveryLocations(query), testMode: isYandexDeliveryTestMode() }
  } catch (error) {
    console.error("[yandex-delivery] Location search failed", error)
    return { data: [], error: error instanceof Error ? error.message : "Не удалось найти населённый пункт", testMode: isYandexDeliveryTestMode() }
  }
}

export async function getShopYandexDeliveryPickupPoints(params: {
  geoId: number
  type: "pickup_point" | "terminal"
}): Promise<ActionResult<YandexDeliveryPickupPoint[]>> {
  try {
    return { data: await listYandexDeliveryPickupPoints(params), testMode: isYandexDeliveryTestMode() }
  } catch (error) {
    console.error("[yandex-delivery] Pickup points request failed", error)
    return { data: [], error: error instanceof Error ? error.message : "Не удалось загрузить пункты выдачи", testMode: isYandexDeliveryTestMode() }
  }
}
