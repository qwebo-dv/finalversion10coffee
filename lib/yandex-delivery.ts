import "server-only"

const TEST_BASE_URL = "https://b2b.taxi.tst.yandex.net"
const PRODUCTION_BASE_URL = "https://b2b-authproxy.taxi.yandex.net"
// The test warehouse listed in the access guide has no pickup intervals. The
// recommended Moscow test PVS is suitable for the self-dropoff workflow.
const TEST_SOURCE_STATION_ID = "e1139f6d-e34f-47a9-a55f-31f032a861a6"

export type YandexDeliveryMode = "pickup_point" | "terminal" | "courier"

export type YandexDeliveryLocation = {
  geoId: number
  address: string
}

export type YandexDeliveryPickupPoint = {
  id: string
  name: string
  type: "pickup_point" | "terminal"
  address: string
  instruction?: string
}

export type YandexDeliveryLine = {
  name: string
  article?: string
  quantity: number
  unitPriceRubles: number
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  weightGrams: number | null
}

export type YandexDeliveryOffer = {
  offerId: string
  cost: number
  expiresAt?: string
  deliveryFrom?: string
  deliveryTo?: string
}

type YandexDeliveryConfig = {
  environment: "test" | "production"
  baseUrl: string
  token: string
  sourceStationId: string
  merchantId?: string
  senderInn?: string
}

function getYandexDeliveryConfig(): YandexDeliveryConfig {
  const environment = process.env.YANDEX_DELIVERY_ENV === "production" ? "production" : "test"
  const isTest = environment === "test"
  const token = process.env.YANDEX_DELIVERY_API_TOKEN?.trim() || ""
  const sourceStationId = process.env.YANDEX_DELIVERY_SOURCE_STATION_ID || (isTest ? TEST_SOURCE_STATION_ID : "")

  if (!token || !sourceStationId) {
    throw new Error(
      isTest
        ? "Для тестовой Яндекс Доставки укажите YANDEX_DELIVERY_API_TOKEN и станцию отправления"
        : "Для боевой Яндекс Доставки укажите токен и станцию отправления",
    )
  }

  return {
    environment,
    baseUrl: isTest ? TEST_BASE_URL : PRODUCTION_BASE_URL,
    token,
    sourceStationId,
    merchantId: process.env.YANDEX_DELIVERY_MERCHANT_ID?.trim() || undefined,
    senderInn: process.env.YANDEX_DELIVERY_SENDER_INN?.trim() || undefined,
  }
}

function getShippingDimension(value: number | null, fallback: number | null) {
  const normalized = Number(value)
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback
}

function normalizeShippingLines(lines: YandexDeliveryLine[], isTest: boolean) {
  return lines.map((line) => {
    // Test mode remains usable before the catalog is filled. Production rejects
    // a quote instead of silently using an arbitrary box for a real shipment.
    const lengthCm = getShippingDimension(line.lengthCm, isTest ? 30 : null)
    const widthCm = getShippingDimension(line.widthCm, isTest ? 20 : null)
    const heightCm = getShippingDimension(line.heightCm, isTest ? 15 : null)
    const weightGrams = getShippingDimension(line.weightGrams, isTest ? 100 : null)
    if (!lengthCm || !widthCm || !heightCm || !weightGrams) {
      throw new Error(`Для товара «${line.name}» не заполнены параметры упаковки для Яндекс Доставки`)
    }
    return { ...line, lengthCm, widthCm, heightCm, weightGrams }
  })
}

function getParcelDimensions(lines: ReturnType<typeof normalizeShippingLines>) {
  const lengthCm = Math.max(...lines.map((line) => line.lengthCm))
  const widthCm = Math.max(...lines.map((line) => line.widthCm))
  // Individual packages are laid out in one parcel vertically. This gives a
  // conservative upper bound until a warehouse-specific packing algorithm is added.
  const heightCm = lines.reduce((sum, line) => sum + line.heightCm * Math.max(1, Math.floor(line.quantity)), 0)
  const weightGrams = lines.reduce((sum, line) => sum + line.weightGrams * Math.max(1, Math.floor(line.quantity)), 0)
  return { lengthCm, widthCm, heightCm, weightGrams }
}

async function yandexRequest<T>(path: string, body: unknown): Promise<T> {
  const config = getYandexDeliveryConfig()
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as { message?: string; code?: string } | T | null
  if (!response.ok) {
    const error = payload as { message?: string; code?: string } | null
    throw new Error(error?.message || `Яндекс Доставка вернула HTTP ${response.status}`)
  }
  return payload as T
}

function parseRubles(value: unknown) {
  const matched = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/)
  return matched ? Math.round(Number(matched[0])) : 0
}

function recipientFrom(fullName: string, phone: string, email: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || "Покупатель",
    last_name: parts.slice(1).join(" ") || undefined,
    phone,
    email,
  }
}

function formatAddressPoint(point: Record<string, unknown>) {
  const address = point.address as Record<string, unknown> | undefined
  return String(address?.full_address || address?.fullAddress || point.address || "")
}

export async function findYandexDeliveryLocations(query: string): Promise<YandexDeliveryLocation[]> {
  const normalized = query.trim().slice(0, 250)
  if (normalized.length < 2) return []
  const result = await yandexRequest<{ variants?: { geo_id?: number; address?: string }[] }>(
    "/api/b2b/platform/location/detect",
    { location: normalized },
  )
  return (result.variants || [])
    .map((variant) => ({ geoId: Number(variant.geo_id), address: String(variant.address || "") }))
    .filter((variant) => Number.isInteger(variant.geoId) && variant.geoId > 0 && variant.address)
}

export async function listYandexDeliveryPickupPoints(params: {
  geoId: number
  type: "pickup_point" | "terminal"
}): Promise<YandexDeliveryPickupPoint[]> {
  if (!Number.isInteger(params.geoId) || params.geoId <= 0) return []
  const result = await yandexRequest<{ points?: Record<string, unknown>[] }>(
    "/api/b2b/platform/pickup-points/list",
    {
      geo_id: params.geoId,
      type: params.type,
      payment_method: "already_paid",
    },
  )
  const points: YandexDeliveryPickupPoint[] = (result.points || [])
    .map((point) => ({
      id: String(point.id || ""),
      name: String(point.name || "Пункт выдачи"),
      type: point.type === "terminal" ? "terminal" as const : "pickup_point" as const,
      address: formatAddressPoint(point),
      instruction: typeof point.instruction === "string" ? point.instruction : undefined,
    }))
    .filter((point) => point.id && point.address && point.type === params.type)
  return points
}

export async function createYandexDeliveryOffer(params: {
  operatorRequestId: string
  mode: YandexDeliveryMode
  pickupPointId?: string
  destinationAddress?: string
  destinationGeoId?: number
  lines: YandexDeliveryLine[]
  recipient: { fullName: string; phone: string; email: string }
  comment?: string
}): Promise<YandexDeliveryOffer> {
  const config = getYandexDeliveryConfig()
  const shippingLines = normalizeShippingLines(params.lines, config.environment === "test")
  const parcel = getParcelDimensions(shippingLines)
  const readyAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const source = {
    platform_station: { platform_id: config.sourceStationId },
    interval_utc: { from: readyAt, to: readyAt },
  }
  const destination = params.mode === "courier"
    ? {
        type: "custom_location",
        custom_location: {
          details: {
            geoId: params.destinationGeoId,
            full_address: params.destinationAddress,
          },
        },
      }
    : {
        type: "platform_station",
        platform_station: { platform_id: params.pickupPointId },
      }

  if (params.mode === "courier" && (!params.destinationAddress || !params.destinationGeoId)) {
    throw new Error("Укажите полный адрес доставки")
  }
  if (params.mode !== "courier" && !params.pickupPointId) {
    throw new Error("Выберите пункт выдачи или постамат")
  }

  const info = {
    operator_request_id: params.operatorRequestId.slice(0, 80),
    ...(config.merchantId ? { merchant_id: config.merchantId } : {}),
    ...(params.comment ? { comment: params.comment.slice(0, 500) } : {}),
  }
  const placeBarcode = `10coffee-${params.operatorRequestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-48) || crypto.randomUUID()}`
  const billingDetails = (unitPriceRubles: number) => ({
    unit_price: Math.max(0, Math.round(unitPriceRubles * 100)),
    assessed_unit_price: Math.max(0, Math.round(unitPriceRubles * 100)),
    nds: -1,
    ...(config.senderInn ? { inn: config.senderInn } : {}),
  })
  const result = await yandexRequest<{
    offers?: {
      offer_id?: string
      expires_at?: string
      offer_details?: {
        pricing_total?: string
        delivery_interval?: { min?: string; max?: string }
      }
    }[]
  }>("/api/b2b/platform/offers/create?send_unix=false", {
    info,
    source,
    destination,
    items: shippingLines.map((line) => ({
      count: Math.max(1, Math.floor(line.quantity)),
      name: line.name.slice(0, 250),
      ...(line.article ? { article: line.article.slice(0, 100) } : {}),
      place_barcode: placeBarcode,
      billing_details: billingDetails(line.unitPriceRubles),
      physical_dims: {
        dx: line.lengthCm,
        dy: line.widthCm,
        dz: line.heightCm,
      },
    })),
    places: [{
      barcode: placeBarcode,
      physical_dims: {
        weight_gross: parcel.weightGrams,
        dx: parcel.lengthCm,
        dy: parcel.widthCm,
        dz: parcel.heightCm,
      },
    }],
    recipient_info: recipientFrom(params.recipient.fullName, params.recipient.phone, params.recipient.email),
    billing_info: { payment_method: "already_paid" },
    last_mile_policy: params.mode === "courier" ? "time_interval" : "self_pickup",
    forbid_unboxing: false,
    particular_items_refuse: false,
  })
  const offer = result.offers?.[0]
  const cost = parseRubles(offer?.offer_details?.pricing_total)
  if (!offer?.offer_id || !Number.isFinite(cost) || cost < 0) {
    throw new Error("Яндекс Доставка не вернула вариант с тарифом")
  }
  return {
    offerId: offer.offer_id,
    cost,
    expiresAt: offer.expires_at,
    deliveryFrom: offer.offer_details?.delivery_interval?.min,
    deliveryTo: offer.offer_details?.delivery_interval?.max,
  }
}

export async function confirmYandexDeliveryOffer(offerId: string) {
  const result = await yandexRequest<{ request_id?: string }>("/api/b2b/platform/offers/confirm", { offer_id: offerId })
  if (!result.request_id) throw new Error("Яндекс Доставка не вернула номер заявки")
  return result.request_id
}

type PaidYandexOrder = {
  id: string | number
  orderId?: string | null
  deliveryMethod?: string | null
  deliveryAddress?: string | null
  yandexDeliveryType?: YandexDeliveryMode | null
  yandexPickupPointId?: string | null
  yandexRequestId?: string | null
  customerFullName?: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  comment?: string | null
  items?: {
    productName?: string | null
    variantName?: string | null
    quantity?: number | null
    unitPrice?: number | null
    shippingLengthCm?: number | null
    shippingWidthCm?: number | null
    shippingHeightCm?: number | null
    shippingWeightGrams?: number | null
  }[] | null
}

export async function createYandexDeliveryRequestForPaidOrder(order: PaidYandexOrder) {
  if (order.deliveryMethod !== "yandex_delivery") return { skipped: true as const }
  if (order.yandexRequestId) return { skipped: true as const, requestId: order.yandexRequestId }
  const mode = order.yandexDeliveryType
  if (!mode) throw new Error("Для заказа не сохранён способ получения Яндекс Доставки")

  let destinationGeoId: number | undefined
  if (mode === "courier") {
    const locations = await findYandexDeliveryLocations(order.deliveryAddress || "")
    destinationGeoId = locations[0]?.geoId
    if (!destinationGeoId) throw new Error("Не удалось определить населённый пункт адреса Яндекс Доставки")
  }

  const offer = await createYandexDeliveryOffer({
    operatorRequestId: `10coffee-${order.orderId || order.id}`,
    mode,
    pickupPointId: order.yandexPickupPointId || undefined,
    destinationAddress: order.deliveryAddress || undefined,
    destinationGeoId,
    lines: (order.items || []).map((item) => ({
      name: [item.productName, item.variantName].filter(Boolean).join(" · ") || "Товар 10coffee",
      quantity: Math.max(1, Number(item.quantity) || 1),
      unitPriceRubles: Math.max(0, Number(item.unitPrice) || 0),
      lengthCm: Number(item.shippingLengthCm) || null,
      widthCm: Number(item.shippingWidthCm) || null,
      heightCm: Number(item.shippingHeightCm) || null,
      weightGrams: Number(item.shippingWeightGrams) || null,
    })),
    recipient: {
      fullName: order.customerFullName || "Покупатель",
      phone: order.customerPhone || "",
      email: order.customerEmail || "",
    },
    comment: order.comment || undefined,
  })
  const requestId = await confirmYandexDeliveryOffer(offer.offerId)
  return { skipped: false as const, requestId, offer }
}

export function isYandexDeliveryTestMode() {
  return (process.env.YANDEX_DELIVERY_ENV || "test") !== "production"
}
