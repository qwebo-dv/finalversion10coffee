import type { Payload } from "payload"
import { dbQuery } from "@/lib/db"
import { getMoyskladConfig, assertMoyskladReady } from "./config"
import type { MoyskladConfig, MoyskladSalesChannel as SalesChannel } from "./config"
import { hasMoyskladErrorCode, MoyskladApiError, extractMoyskladId, moyskladGetList, moyskladMeta, moyskladRequest } from "./client"
import { writeMoyskladLog } from "./logs"
import { computeOrderContentHash } from "./order-hash"
import { DELIVERY_METHOD_LABELS } from "@/lib/utils/constants"
import { ensureMoyskladBundleForVariant } from "./bundles"
import type {
  MoyskladCounterparty,
  MoyskladCustomerOrder,
  MoyskladInvoiceOut,
  MoyskladLoss,
  MoyskladOrderPositionPayload,
  MoyskladSalesChannel,
} from "./types"
import type { CartItem, DeliveryMethod } from "@/types"

interface SyncClient {
  id?: string | number
  fullName?: string
  email?: string
  phone?: string | null
  moyskladCounterpartyId?: string | null
}

interface SyncCompany {
  id?: string
  name?: string
  inn?: string
  kpp?: string | null
  ogrn?: string | null
  legalAddress?: string | null
  actualAddress?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  moyskladCounterpartyId?: string | null
}

interface SyncOrder {
  id: string | number
  orderId?: string
  salesChannel?: SalesChannel
  customerType?: "individual" | "business"
  createdAt?: string
  subtotal?: number
  discountAmount?: number
  deliveryCost?: number
  total?: number
  deliveryMethod?: DeliveryMethod
  deliveryAddress?: string | null
  comment?: string | null
  moyskladCustomerOrderId?: string | null
  moyskladInvoiceOutId?: string | null
}

interface SyncOrderParams {
  payload: Payload
  order: SyncOrder
  client: SyncClient
  company?: SyncCompany | null
  cartItems: CartItem[]
  discountLines?: MoyskladDiscountLine[]
}

interface MoyskladDiscountLine {
  cartItemId: string
  discountPercent: number
}

interface MoyskladProductUomResponse {
  uom?: {
    name?: string
  }
  productFolder?: {
    meta?: {
      href?: string
    }
  }
}

interface MoyskladVariantForBundle {
  id?: string
  name?: string
  code?: string
  article?: string
  salePrices?: {
    value?: number
    priceType?: {
      id?: string
      name?: string
      meta?: {
        href?: string
        type?: string
        mediaType?: string
      }
    }
  }[]
}

interface MoyskladBundleForOrder {
  id?: string
  name?: string
}

export interface MoyskladStockLossLine {
  productMoyskladId: string
  productName: string
  quantityKg: number
  pricePerKg: number
  sourceLine: string
}

interface PayloadOrderStockLossItem {
  productName?: string
  variantName?: string
  grindOption?: string | null
  quantity?: number | string
  stockProductMoyskladId?: string | null
  stockQuantityKg?: number | string | null
  stockPricePerKg?: number | string | null
}

interface PayloadOrderForStockLoss {
  id: string | number
  orderId?: string
  createdAt?: string
  moyskladStockLossId?: string | null
  items?: PayloadOrderStockLossItem[]
}

const kilogramProductCache = new Map<string, Promise<boolean>>()
const bundleCache = new Map<string, Promise<MoyskladBundleForOrder>>()


function normalizeMoyskladDiscount(value: unknown) {
  const numeric = Number(value) || 0
  const bounded = Math.max(0, Math.min(100, numeric))
  return Math.round(bounded * 100) / 100
}

export class MoyskladTrashedOrderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MoyskladTrashedOrderError"
  }
}

function isMoyskladTrashOperationError(error: unknown) {
  if (!(error instanceof MoyskladApiError)) return false

  const message = error.message.toLowerCase()
  if (message.includes("находится в корзине") || message.includes("trash")) return true

  const errors = (error.body as { errors?: unknown })?.errors
  if (!Array.isArray(errors)) return false

  return errors.some((item) => {
    if (!item || typeof item !== "object") return false
    const details = item as { error?: unknown; code?: unknown }
    return details.code === 3007 &&
      typeof details.error === "string" &&
      details.error.toLowerCase().includes("находится в корзине")
  })
}

function rubToKopecks(value: number) {
  return Math.round((Number(value) || 0) * 100)
}

function formatMoment(date = new Date()) {
  const pad = (value: number, size = 2) => String(value).padStart(size, "0")
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
    ".000",
  ].join("")
}

function buildCounterpartyPayload(client: SyncClient, company?: SyncCompany | null) {
  const name = company?.name || client.fullName || client.email || "Клиент 10coffee"
  const result: Record<string, unknown> = {
    name,
    email: company?.contactEmail || client.email || undefined,
    phone: company?.contactPhone || client.phone || undefined,
    description: "Создано автоматически с сайта 10coffee",
  }

  if (company?.inn) result.inn = company.inn
  if (company?.kpp) result.kpp = company.kpp
  if (company?.ogrn) result.ogrn = company.ogrn
  if (company?.legalAddress) result.legalAddress = company.legalAddress
  if (company?.actualAddress) result.actualAddress = company.actualAddress
  if (company?.name) result.legalTitle = company.name

  return result
}

async function updateCompanyCounterpartyId(companyId: string | undefined, counterpartyId: string) {
  if (!companyId) return
  await dbQuery(
    "update public.companies set moysklad_counterparty_id = $1, updated_at = now() where id = $2",
    [counterpartyId, companyId]
  )
}

async function clearCompanyCounterpartyId(companyId: string | undefined) {
  if (!companyId) return
  await dbQuery(
    "update public.companies set moysklad_counterparty_id = null, updated_at = now() where id = $1",
    [companyId]
  )
}

function normalizeInn(value?: string | null) {
  return (value || "").trim()
}

async function findCounterpartyByEmail(email: string) {
  const filter = `email=${email}`
  const result = await moyskladGetList<MoyskladCounterparty>("entity/counterparty", {
    filter,
    limit: 1,
  })
  return result.rows[0] || null
}

async function findCounterpartyByInn(inn: string) {
  const filter = `inn=${inn}`
  const result = await moyskladGetList<MoyskladCounterparty>("entity/counterparty", {
    filter,
    limit: 1,
  })
  return result.rows[0] || null
}

async function findCounterpartyById(id: string) {
  return moyskladRequest<MoyskladCounterparty>(`entity/counterparty/${id}`)
}

async function updateCounterpartyContactData(id: string, client: SyncClient, company?: SyncCompany | null) {
  return moyskladRequest<MoyskladCounterparty>(`entity/counterparty/${id}`, {
    method: "PUT",
    body: JSON.stringify(buildCounterpartyPayload(client, company)),
  })
}

async function ensureCounterparty(payload: Payload, client: SyncClient, company: SyncCompany | null | undefined, config: MoyskladConfig) {
  assertMoyskladReady(config)

  if (company) {
    if (company.moyskladCounterpartyId) {
      const linkedCounterparty = await findCounterpartyById(company.moyskladCounterpartyId).catch(() => null)
      const linkedInn = normalizeInn(linkedCounterparty?.inn)
      const companyInn = normalizeInn(company.inn)

      if (!companyInn || linkedInn === companyInn) {
        await updateCounterpartyContactData(company.moyskladCounterpartyId, client, company).catch(() => null)
        return company.moyskladCounterpartyId
      }

      await clearCompanyCounterpartyId(company.id)
    }

    if (company.inn) {
      const existing = await findCounterpartyByInn(company.inn)
      const existingId = extractMoyskladId(existing)
      if (existingId) {
        await updateCounterpartyContactData(existingId, client, company).catch(() => null)
        await updateCompanyCounterpartyId(company.id, existingId)
        return existingId
      }
    }

    if (!config.createCounterparties) {
      throw new Error("Контрагент не найден, а создание контрагентов отключено")
    }

    const created = await moyskladRequest<MoyskladCounterparty>("entity/counterparty", {
      method: "POST",
      body: JSON.stringify(buildCounterpartyPayload(client, company)),
    })
    const createdId = extractMoyskladId(created)
    if (!createdId) throw new Error("МойСклад не вернул id контрагента")

    await updateCompanyCounterpartyId(company.id, createdId)
    return createdId
  }

  if (client.moyskladCounterpartyId) {
    await updateCounterpartyContactData(client.moyskladCounterpartyId, client, company).catch(() => null)
    return client.moyskladCounterpartyId
  }

  if (client.email) {
    const existing = await findCounterpartyByEmail(client.email)
    const existingId = extractMoyskladId(existing)
    if (existingId) {
      await updateCounterpartyContactData(existingId, client, company).catch(() => null)
      if (client.id) {
        await payload.update({
          collection: "clients",
          id: client.id,
          data: { moyskladCounterpartyId: existingId },
        })
      }
      return existingId
    }
  }

  if (!config.createCounterparties) {
    throw new Error("Контрагент не найден, а создание контрагентов отключено")
  }

  const created = await moyskladRequest<MoyskladCounterparty>("entity/counterparty", {
    method: "POST",
    body: JSON.stringify(buildCounterpartyPayload(client, company)),
  })
  const createdId = extractMoyskladId(created)
  if (!createdId) throw new Error("МойСклад не вернул id контрагента")

  if (client.id) {
    await payload.update({
      collection: "clients",
      id: client.id,
      data: { moyskladCounterpartyId: createdId },
    })
  }

  return createdId
}

async function findSalesChannelByName(name: string) {
  const result = await moyskladGetList<MoyskladSalesChannel>("entity/saleschannel", {
    filter: `name=${name}`,
    limit: 1,
  })
  return result.rows[0] || null
}

async function ensureSalesChannel(config: MoyskladConfig) {
  if (config.salesChannelId) return config.salesChannelId
  if (!config.salesChannelName) return null

  const existing = await findSalesChannelByName(config.salesChannelName)
  const existingId = extractMoyskladId(existing)
  if (existingId) return existingId

  if (!config.createSalesChannel) return null

  const created = await moyskladRequest<MoyskladSalesChannel>("entity/saleschannel", {
    method: "POST",
    body: JSON.stringify({
      name: config.salesChannelName,
      type: config.salesChannelType,
      description: config.channel === "wholesale"
        ? "Оптовые заказы кабинета 10coffee"
        : "Розничные заказы интернет-магазина 10coffee",
    }),
  })

  return extractMoyskladId(created)
}

function buildOrderDescription(order: SyncOrder, company?: SyncCompany | null) {
  const deliveryMethodLabel = order.deliveryMethod
    ? DELIVERY_METHOD_LABELS[order.deliveryMethod] || order.deliveryMethod
    : ""
  const rows = [
    `Заказ сайта: ${order.orderId || order.id}`,
    order.customerType === "individual" ? "Тип заказа: розничный (shop.10coffee.ru)" : "",
    company?.name ? `Компания: ${company.name}` : "",
    company?.inn ? `ИНН: ${company.inn}` : "",
    deliveryMethodLabel ? `Доставка: ${deliveryMethodLabel}` : "",
    order.deliveryAddress ? `Адрес: ${order.deliveryAddress}` : "",
    order.comment ? `Комментарий: ${order.comment}` : "",
  ].filter(Boolean)

  return rows.join("\n")
}

function buildOrderDescriptionWithComposition(
  order: SyncOrder,
  company?: SyncCompany | null,
  compositionLines: string[] = []
) {
  const description = buildOrderDescription(order, company)
  if (compositionLines.length === 0) return description

  return [
    description,
    "Состав заказа:",
    ...compositionLines.map((line) => `- ${line}`),
  ].filter(Boolean).join("\n")
}

function getSkippedPositionReason(item: CartItem) {
  if (isCoffeeWeightAccountingItem(item) && !item.variant?.moysklad_id) {
    return "нужен ID модификации МойСклад для комплекта"
  }

  return "не заполнен moyskladId"
}

function resolveAssortment(item: CartItem) {
  const variant = item.variant as (CartItem["variant"] & {
    moysklad_id?: string | null
    moysklad_type?: "product" | "variant" | "service" | null
  }) | undefined
  const product = item.product as (CartItem["product"] & {
    moysklad_id?: string | null
  }) | undefined

  if (variant?.moysklad_id) {
    return {
      id: variant.moysklad_id,
      type: variant.moysklad_type || "variant",
    }
  }

  if (product?.moysklad_id) {
    return {
      id: product.moysklad_id,
      type: "product" as const,
    }
  }

  return null
}

function isCoffeeWeightAccountingItem(item: CartItem) {
  return Boolean(
    item.product?.product_type_schema === "coffee" &&
    item.product?.moysklad_id &&
    item.variant?.weight_grams &&
    item.variant.weight_grams > 0
  )
}

function normalizeUomName(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/ё/g, "е")
}

async function isKilogramProduct(moyskladProductId: string) {
  const cached = kilogramProductCache.get(moyskladProductId)
  if (cached) return cached

  const promise = moyskladRequest<MoyskladProductUomResponse>(
    `entity/product/${moyskladProductId}?expand=uom`
  )
    .then((product) => {
      const uomName = normalizeUomName(product.uom?.name)
      return uomName === "кг" || uomName.includes("килограмм")
    })
    .catch(() => false)

  kilogramProductCache.set(moyskladProductId, promise)
  return promise
}

function shouldUseBundleAccounting(item: CartItem, productMoyskladId: string) {
  return Boolean(
    productMoyskladId &&
    isCoffeeWeightAccountingItem(item) &&
    item.variant?.moysklad_id
  )
}

async function getMoyskladVariantForBundle(variantMoyskladId: string) {
  return moyskladRequest<MoyskladVariantForBundle>(`entity/variant/${variantMoyskladId}`)
    .catch(() => null)
}

async function getMoyskladProductForBundle(productMoyskladId: string) {
  return moyskladRequest<MoyskladProductUomResponse>(`entity/product/${productMoyskladId}`)
    .catch(() => null)
}

async function ensureBundleForWeightAccountingItem(
  item: CartItem,
  productMoyskladId: string,
  weightGrams: number
) {
  const variantMoyskladId = item.variant?.moysklad_id || null
  if (!variantMoyskladId) {
    throw new Error(`У варианта ${item.variant?.name || item.variant_id} нет ID модификации МойСклад`)
  }

  const cacheKey = [
    productMoyskladId,
    variantMoyskladId,
    weightGrams,
    item.variant?.price ?? 0,
    item.variant?.name || "",
    item.grind_option || "",
  ].join(":")
  const cached = bundleCache.get(cacheKey)
  if (cached) return cached

  const promise = (async () => {
    const [moyskladVariant, moyskladProduct] = await Promise.all([
      getMoyskladVariantForBundle(variantMoyskladId),
      getMoyskladProductForBundle(productMoyskladId),
    ])

    return ensureMoyskladBundleForVariant({
      productMoyskladId,
      variantMoyskladId,
      variantName: moyskladVariant?.name || `${item.product?.name || item.product_id} (${item.variant?.name || item.variant_id}${getCartItemGrindLabel(item)})`,
      variantCode: moyskladVariant?.code || item.variant?.sku,
      variantArticle: moyskladVariant?.article || item.variant?.sku,
      salePrices: moyskladVariant?.salePrices,
      productFolder: moyskladProduct?.productFolder,
      weightGrams,
      priceRub: item.variant?.price ?? 0,
    })
  })()

  bundleCache.set(cacheKey, promise)
  return promise
}

function getCartItemGrindLabel(item: CartItem) {
  const grind = item.grind_option || item.variant?.grind_options?.[0] || ""
  return grind ? `, ${grind}` : ""
}

function formatWeightFromGrams(grams: number) {
  if (!Number.isFinite(grams) || grams <= 0) return ""
  if (grams >= 1000 && grams % 1000 === 0) return `${grams / 1000} кг`
  if (grams >= 1000) return `${Number((grams / 1000).toFixed(3))} кг`
  return `${grams} г`
}

export function buildMoyskladStockLossLines(cartItems: CartItem[]) {
  const lines: MoyskladStockLossLine[] = []

  for (const item of cartItems) {
    const productMoyskladId = item.product?.moysklad_id || null
    if (!isCoffeeWeightAccountingItem(item) || !productMoyskladId) continue

    const weightGrams = Number(item.variant?.weight_grams) || 0
    const weightKgPerPack = weightGrams / 1000
    const quantityKg = weightKgPerPack * item.quantity
    const variantPriceKopecks = rubToKopecks(item.variant?.price ?? 0)
    const pricePerKg = weightKgPerPack > 0
      ? Math.round(variantPriceKopecks / weightKgPerPack)
      : 0

    if (quantityKg <= 0 || pricePerKg <= 0) continue

    lines.push({
      productMoyskladId,
      productName: item.product?.name || item.product_id,
      quantityKg: Number(quantityKg.toFixed(6)),
      pricePerKg,
      sourceLine: `${item.product?.name || item.product_id}: ${item.variant?.name || item.variant_id}${getCartItemGrindLabel(item)} ×${item.quantity} (${formatWeightFromGrams(weightGrams * item.quantity)})`,
    })
  }

  return lines
}

async function buildCustomerPositions(
  cartItems: CartItem[],
  deliveryCost: number,
  discountLines: MoyskladDiscountLine[] = [],
  positionVat = 0,
  config: MoyskladConfig,
) {
  const discountByItem = new Map(
    discountLines.map((line) => [
      line.cartItemId,
      normalizeMoyskladDiscount(line.discountPercent),
    ])
  )

  const skipped: CartItem[] = []
  const positions: MoyskladOrderPositionPayload[] = []
  const compositionLines: string[] = []
  for (const item of cartItems) {
    const productMoyskladId = item.product?.moysklad_id || null
    const weightGrams = Number(item.variant?.weight_grams) || 0

    if (productMoyskladId && shouldUseBundleAccounting(item, productMoyskladId)) {
      const bundle = await ensureBundleForWeightAccountingItem(item, productMoyskladId, weightGrams)
      if (!bundle.id) {
        throw new Error(`Не удалось создать комплект для ${item.variant?.name || item.variant_id}`)
      }

      const position: MoyskladOrderPositionPayload = {
        quantity: item.quantity,
        price: rubToKopecks(item.variant?.price ?? 0),
        assortment: {
          meta: moyskladMeta("bundle", bundle.id),
        },
      }

      const discount = discountByItem.get(item.id) || 0
      if (discount > 0) position.discount = discount
      if (positionVat > 0) position.vat = positionVat

      positions.push(position)
      compositionLines.push(
        `${item.product?.name || item.product_id}: ${item.variant?.name || item.variant_id}${getCartItemGrindLabel(item)} ×${item.quantity} (${formatWeightFromGrams(weightGrams * item.quantity)})`
      )
      continue
    }

    if (
      isCoffeeWeightAccountingItem(item) &&
      productMoyskladId &&
      await isKilogramProduct(productMoyskladId)
    ) {
      skipped.push(item)
      continue
    }

    const assortment = resolveAssortment(item)
    if (!assortment) {
      skipped.push(item)
      continue
    }

    const position: MoyskladOrderPositionPayload = {
      quantity: item.quantity,
      price: rubToKopecks(item.variant?.price ?? 0),
      assortment: {
        meta: moyskladMeta(assortment.type, assortment.id),
      },
    }

    const discount = discountByItem.get(item.id) || 0
    if (discount > 0) position.discount = discount
    if (positionVat > 0) position.vat = positionVat

    positions.push(position)
  }

  if (deliveryCost > 0) {
    if (!config.deliveryServiceId) {
      throw new Error("Для передачи доставки в МойСклад нужен MOYSKLAD_DELIVERY_SERVICE_ID")
    }

    const deliveryPosition: MoyskladOrderPositionPayload = {
      quantity: 1,
      price: rubToKopecks(deliveryCost),
      assortment: {
        meta: moyskladMeta("service", config.deliveryServiceId),
      },
    }

    if (positionVat > 0) deliveryPosition.vat = positionVat
    positions.push(deliveryPosition)
  }

  return { positions, skipped, compositionLines }
}

function buildDocumentRefs(params: {
  counterpartyId: string
  positions: MoyskladOrderPositionPayload[]
  description: string
  shipmentAddress?: string | null
  salesChannelId?: string | null
  createdAt?: string
}, config: MoyskladConfig) {
  const orderDate = params.createdAt ? new Date(params.createdAt) : undefined
  const body: Record<string, unknown> = {
    moment: formatMoment(orderDate),
    applicable: true,
    vatEnabled: config.vatEnabled,
    vatIncluded: config.vatIncluded,
    organization: {
      meta: moyskladMeta("organization", config.organizationId!),
    },
    agent: {
      meta: moyskladMeta("counterparty", params.counterpartyId),
    },
    positions: params.positions,
    description: params.description,
  }

  if (config.storeId) body.store = { meta: moyskladMeta("store", config.storeId) }
  if (config.projectId) body.project = { meta: moyskladMeta("project", config.projectId) }
  if (config.contractId) body.contract = { meta: moyskladMeta("contract", config.contractId) }
  if (params.salesChannelId) body.salesChannel = { meta: moyskladMeta("saleschannel", params.salesChannelId) }
  if (params.shipmentAddress) body.shipmentAddress = params.shipmentAddress

  return body
}

async function findCustomerOrderByExternalCode(externalCode: string) {
  const result = await moyskladGetList<MoyskladCustomerOrder>("entity/customerorder", {
    filter: `externalCode=${externalCode}`,
    limit: 1,
  })

  return result.rows[0] || null
}

async function findInvoiceOutByExternalCode(externalCode: string) {
  const result = await moyskladGetList<MoyskladInvoiceOut>("entity/invoiceout", {
    filter: `externalCode=${externalCode}`,
    limit: 1,
  })

  return result.rows[0] || null
}

async function findArchivedInvoiceOutByExternalCode(externalCode: string) {
  const result = await moyskladGetList<MoyskladInvoiceOut>("entity/invoiceout", {
    filter: `externalCode=${externalCode};archived=true`,
    limit: 1,
  })

  return result.rows[0] || null
}

async function findArchivedCustomerOrderByExternalCode(externalCode: string) {
  const result = await moyskladGetList<MoyskladCustomerOrder>("entity/customerorder", {
    filter: `externalCode=${externalCode};archived=true`,
    limit: 1,
  })

  return result.rows[0] || null
}

async function deleteMoyskladEntity(entityPath: string) {
  try {
    await moyskladRequest(entityPath, { method: "DELETE" })
  } catch {
    // Best-effort: if deletion fails we still move on to create a fresh document.
  }
}

async function createInvoiceOut(params: {
  order: SyncOrder
  counterpartyId: string
  moyskladOrderId: string
  positions: MoyskladOrderPositionPayload[]
  description: string
  shipmentAddress?: string | null
  salesChannelId?: string | null
  config: MoyskladConfig
}) {
  const externalCode = `${params.order.orderId || params.order.id}-invoice`
  const invoiceBody = {
    ...buildDocumentRefs({
      counterpartyId: params.counterpartyId,
      positions: params.positions,
      description: params.description,
      shipmentAddress: params.shipmentAddress,
      salesChannelId: params.salesChannelId,
      createdAt: params.order.createdAt,
    }, params.config),
    externalCode,
    customerOrder: {
      meta: moyskladMeta("customerorder", params.moyskladOrderId),
    },
  }

  let invoiceId = params.order.moyskladInvoiceOutId || null
  if (!invoiceId) {
    const existing = await findInvoiceOutByExternalCode(externalCode).catch(() => null)
    invoiceId = extractMoyskladId(existing)
  }

  if (invoiceId) {
    try {
      const updated = await moyskladRequest<MoyskladInvoiceOut>(`entity/invoiceout/${invoiceId}`, {
        method: "PUT",
        body: JSON.stringify(invoiceBody),
      })

      return {
        invoice: updated,
        invoiceId,
        payload: invoiceBody,
        reused: true as const,
      }
    } catch (error) {
      if (isMoyskladTrashOperationError(error)) {
        await deleteMoyskladEntity(`entity/invoiceout/${invoiceId}`)
        invoiceId = null
      } else if (hasMoyskladErrorCode(error, 1021)) {
        invoiceId = null
      } else {
        throw error
      }
    }
  }

  try {
    const created = await moyskladRequest<MoyskladInvoiceOut>("entity/invoiceout", {
      method: "POST",
      body: JSON.stringify(invoiceBody),
    })

    return {
      invoice: created,
      invoiceId: extractMoyskladId(created),
      payload: invoiceBody,
    }
  } catch (error) {
    if (!hasMoyskladErrorCode(error, 3006)) throw error

    const conflicting = await findArchivedInvoiceOutByExternalCode(externalCode).catch(() => null)
    const conflictingId = extractMoyskladId(conflicting)
    if (conflictingId) {
      await deleteMoyskladEntity(`entity/invoiceout/${conflictingId}`)

      const created = await moyskladRequest<MoyskladInvoiceOut>("entity/invoiceout", {
        method: "POST",
        body: JSON.stringify(invoiceBody),
      })

      return {
        invoice: created,
        invoiceId: extractMoyskladId(created),
        payload: invoiceBody,
      }
    }

    return null
  }
}

function buildStockLossExternalCode(order: PayloadOrderForStockLoss) {
  return `10coffee-stock-loss-${order.id}`
}

function getStoredStockLossPositions(order: PayloadOrderForStockLoss) {
  const positionsByKey = new Map<string, MoyskladOrderPositionPayload>()
  const compositionLines: string[] = []

  for (const item of order.items || []) {
    const productMoyskladId = item.stockProductMoyskladId?.trim()
    const quantityKg = Number(item.stockQuantityKg) || 0
    const pricePerKg = Math.round(Number(item.stockPricePerKg) || 0)
    if (!productMoyskladId || quantityKg <= 0 || pricePerKg <= 0) continue

    const key = `${productMoyskladId}:${pricePerKg}`
    const existing = positionsByKey.get(key)
    if (existing) {
      existing.quantity = Number((existing.quantity + quantityKg).toFixed(6))
    } else {
      positionsByKey.set(key, {
        quantity: Number(quantityKg.toFixed(6)),
        price: pricePerKg,
        assortment: {
          meta: moyskladMeta("product", productMoyskladId),
        },
      })
    }

    const parts = [
      item.productName || "Товар",
      item.variantName ? `(${item.variantName})` : "",
      item.grindOption ? `, ${item.grindOption}` : "",
      `×${Number(item.quantity) || 0}`,
      `(${Number(quantityKg.toFixed(3))} кг)`,
    ].filter(Boolean)
    compositionLines.push(parts.join(" "))
  }

  return {
    positions: [...positionsByKey.values()],
    compositionLines,
  }
}

async function findStockLossByExternalCode(externalCode: string) {
  const result = await moyskladGetList<MoyskladLoss>("entity/loss", {
    filter: `externalCode=${externalCode}`,
    limit: 1,
  })

  return result.rows[0] || null
}

export async function ensureMoyskladStockLossForOrder(
  payload: Payload,
  order: PayloadOrderForStockLoss
) {
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { skipped: true as const, reason: "MOYSKLAD_ENABLED не включен" }
  }
  assertMoyskladReady(config)


  if (order.moyskladStockLossId) {
    return { skipped: true as const, moyskladStockLossId: order.moyskladStockLossId }
  }

  if (!config.storeId) {
    throw new Error("Для технического списания нужен MOYSKLAD_STORE_ID")
  }

  const { positions, compositionLines } = getStoredStockLossPositions(order)
  if (positions.length === 0) {
    return { skipped: true as const, reason: "Нет весовых позиций для списания" }
  }

  const externalCode = buildStockLossExternalCode(order)
  const existing = await findStockLossByExternalCode(externalCode).catch(() => null)
  const existingId = extractMoyskladId(existing)

  if (existingId) {
    await payload.update({
      collection: "orders",
      id: order.id,
      data: {
        moyskladStockLossId: existingId,
        moyskladStockLossSyncedAt: new Date().toISOString(),
        moyskladStockLossError: "",
      },
    })

    return { success: true as const, moyskladStockLossId: existingId, reused: true as const }
  }

  const description = [
    `Техническое списание по заказу ${order.orderId || order.id}`,
    "Состав заказа:",
    ...compositionLines.map((line) => `- ${line}`),
  ].join("\n")

  const stockLossDate = order.createdAt ? new Date(order.createdAt) : undefined
  const body = {
    moment: formatMoment(stockLossDate),
    applicable: true,
    externalCode,
    organization: {
      meta: moyskladMeta("organization", config.organizationId!),
    },
    store: {
      meta: moyskladMeta("store", config.storeId),
    },
    description,
    positions,
  }

  const created = await moyskladRequest<MoyskladLoss>("entity/loss", {
    method: "POST",
    body: JSON.stringify(body),
  })
  const moyskladStockLossId = extractMoyskladId(created)
  if (!moyskladStockLossId) throw new Error("МойСклад не вернул id технического списания")

  await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      moyskladStockLossId,
      moyskladStockLossSyncedAt: new Date().toISOString(),
      moyskladStockLossError: "",
    },
  })

  await writeMoyskladLog({
    entityType: "stock_loss",
    localId: order.id,
    moyskladId: moyskladStockLossId,
    direction: "site_to_moysklad",
    status: "success",
    payload: body,
    response: created,
  })

  return { success: true as const, moyskladStockLossId }
}

export async function syncOrderToMoysklad(params: SyncOrderParams) {
  const salesChannel: SalesChannel = params.order.salesChannel || (params.order.customerType === "individual" ? "retail" : "wholesale")
  const config = getMoyskladConfig(salesChannel)
  if (!config.enabled || !config.syncOrdersOnCreate) {
    return { skipped: true as const }
  }

  const orderId = params.order.id
  let counterpartyIdForUpdate: string | null = null
  let moyskladOrderIdForUpdate: string | null = null
  let moyskladInvoiceOutIdForUpdate: string | null = null

  try {
    assertMoyskladReady(config)

    await params.payload.update({
      collection: "orders",
      id: orderId,
      data: {
        moyskladSyncStatus: "pending",
        moyskladSyncError: "",
      },
    })


    const counterpartyId = await ensureCounterparty(params.payload, params.client, params.company, config)
    counterpartyIdForUpdate = counterpartyId
    const salesChannelId = await ensureSalesChannel(config)
    let positionVat = config.defaultVat
    if (config.vatEnabled && positionVat <= 0) {
      try {
        const siteSettings = await params.payload.findGlobal({ slug: "site-settings" })
        positionVat = Number((siteSettings as { vatPercent?: number | string }).vatPercent) || 0
      } catch {
        positionVat = 0
      }
    }
    if (!config.vatEnabled) positionVat = 0

    const { positions, skipped, compositionLines } = await buildCustomerPositions(
      params.cartItems,
      Number(params.order.deliveryCost) || 0,
      params.discountLines || [],
      positionVat,
      config,
    )

    if (skipped.length > 0) {
      const names = skipped.map((item) => {
        const label = `${item.product?.name || item.product_id} / ${item.variant?.name || item.variant_id}`
        return `${label} (${getSkippedPositionReason(item)})`
      })
      throw new Error(`Позиции не готовы к выгрузке в МойСклад: ${names.join(", ")}`)
    }

    if (positions.length === 0) {
      throw new Error("Нет позиций для отправки в МойСклад")
    }

    const description = buildOrderDescriptionWithComposition(
      params.order,
      params.company,
      compositionLines
    )
    const body: Record<string, unknown> = {
      ...buildDocumentRefs({
        counterpartyId,
        positions,
        description,
        shipmentAddress: params.order.deliveryAddress,
        salesChannelId,
        createdAt: params.order.createdAt,
      }, config),
      name: params.order.orderId || String(orderId),
      externalCode: String(orderId),
    }

    if (config.defaultOrderStateId) {
      body.state = { meta: moyskladMeta("state", config.defaultOrderStateId) }
    }

    let orderResponse: MoyskladCustomerOrder | null = null
    let orderMessage: string | undefined
    let moyskladOrderId = params.order.moyskladCustomerOrderId || null

    if (!moyskladOrderId) {
      const existing = await findCustomerOrderByExternalCode(String(orderId)).catch(() => null)
      moyskladOrderId = extractMoyskladId(existing)
    }

    if (moyskladOrderId) {
      delete body.state
      try {
        orderResponse = await moyskladRequest<MoyskladCustomerOrder>(`entity/customerorder/${moyskladOrderId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        orderMessage = "Заказ уже существовал в МойСклад, позиции и суммы обновлены"
      } catch (error) {
        if (isMoyskladTrashOperationError(error)) {
          throw new MoyskladTrashedOrderError(
            `Заказ ${params.order.orderId || String(orderId)} находится в корзине МойСклад, пропущен`
          )
        }
        if (hasMoyskladErrorCode(error, 1021)) {
          moyskladOrderId = null
          if (config.defaultOrderStateId) {
            body.state = { meta: moyskladMeta("state", config.defaultOrderStateId) }
          }
          await params.payload.update({
            collection: "orders",
            id: orderId,
            data: { moyskladCustomerOrderId: null, moyskladInvoiceOutId: null },
          }).catch(() => {})
        } else {
          throw error
        }
      }
    }

    if (!moyskladOrderId) {
      try {
        orderResponse = await moyskladRequest<MoyskladCustomerOrder>("entity/customerorder", {
          method: "POST",
          body: JSON.stringify(body),
        })
      } catch (error) {
        if (!hasMoyskladErrorCode(error, 3006)) throw error

        const conflicting = await findArchivedCustomerOrderByExternalCode(String(orderId)).catch(() => null)
        const conflictingId = extractMoyskladId(conflicting)
        if (conflictingId) {
          await deleteMoyskladEntity(`entity/customerorder/${conflictingId}`)

          orderResponse = await moyskladRequest<MoyskladCustomerOrder>("entity/customerorder", {
            method: "POST",
            body: JSON.stringify(body),
          })
        } else {
          throw new MoyskladTrashedOrderError(
            `Заказ ${params.order.orderId || String(orderId)} не может быть создан: конфликт имени с документом в корзине МойСклад`
          )
        }
      }
      moyskladOrderId = extractMoyskladId(orderResponse)
    }

    moyskladOrderIdForUpdate = moyskladOrderId

    await writeMoyskladLog({
      entityType: "order",
      localId: orderId,
      moyskladId: moyskladOrderId,
      direction: "site_to_moysklad",
      status: "success",
      message: orderMessage,
      payload: body,
      response: orderResponse || undefined,
    })

    let moyskladInvoiceOutId: string | null = null
    let invoiceResponse: MoyskladInvoiceOut | null = null
    let invoicePayload: Record<string, unknown> | null = null

    // Retail orders are only reservations until payment and fulfilment are
    // confirmed. They must not create a B2B invoice automatically.
    if (config.createInvoiceOnOrder && params.order.customerType !== "individual" && moyskladOrderId) {
      const invoiceResult = await createInvoiceOut({
        order: params.order,
        counterpartyId,
        moyskladOrderId,
        positions,
        description,
        shipmentAddress: params.order.deliveryAddress,
        salesChannelId,
        config,
      })
      if (invoiceResult) {
        moyskladInvoiceOutId = invoiceResult.invoiceId
        moyskladInvoiceOutIdForUpdate = moyskladInvoiceOutId
        invoiceResponse = invoiceResult.invoice
        invoicePayload = invoiceResult.payload
      }
    }

    const updateData: Record<string, unknown> = {
      moyskladCounterpartyId: counterpartyId,
      moyskladCustomerOrderId: moyskladOrderId,
      moyskladInvoiceOutId,
      moyskladSyncStatus: "synced",
      moyskladSyncError: "",
      moyskladSyncedAt: new Date().toISOString(),
    }
    if (moyskladInvoiceOutId) {
      updateData.paymentStatus = "invoiced"
    }

    // Store a content hash of the order as it was successfully synced. The
    // "Повторить/обновить выгрузку" action uses it to skip orders that are
    // already in MoySklad and unchanged, instead of re-pushing every order.
    try {
      const storedOrder = await params.payload.findByID({
        collection: "orders",
        id: orderId,
        depth: 0,
      })
      updateData.moyskladSyncedHash = computeOrderContentHash(storedOrder as Parameters<typeof computeOrderContentHash>[0])
    } catch {
      // Non-fatal: if the hash cannot be computed the order will simply be
      // re-synced on the next manual retry.
    }

    await params.payload.update({
      collection: "orders",
      id: orderId,
      data: updateData,
    })

    if (moyskladInvoiceOutId) {
      await writeMoyskladLog({
        entityType: "invoice",
        localId: orderId,
        moyskladId: moyskladInvoiceOutId,
        direction: "site_to_moysklad",
        status: "success",
        payload: invoicePayload || undefined,
        response: invoiceResponse || undefined,
      })
    }

    return { success: true as const, moyskladOrderId, moyskladInvoiceOutId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка синхронизации с МойСклад"
    // A trashed-document name conflict is not a sync failure the code can
    // retry its way out of — it needs a human to resolve it in MoySklad's
    // recycle bin (restore or permanently delete the conflicting document).
    // We still record it as an error so it stays visible on the order, but
    // flag it so callers (the bulk retry action) can report it as a
    // "skipped" conflict instead of a generic failure.
    const isTrashedConflict = error instanceof MoyskladTrashedOrderError

    const errorData: Record<string, unknown> = {
      moyskladSyncStatus: "error",
      moyskladSyncError: message,
    }
    if (counterpartyIdForUpdate) errorData.moyskladCounterpartyId = counterpartyIdForUpdate
    if (moyskladOrderIdForUpdate) errorData.moyskladCustomerOrderId = moyskladOrderIdForUpdate
    if (moyskladInvoiceOutIdForUpdate) errorData.moyskladInvoiceOutId = moyskladInvoiceOutIdForUpdate

    await params.payload.update({
      collection: "orders",
      id: orderId,
      data: errorData,
    })

    await writeMoyskladLog({
      entityType: "order",
      localId: orderId,
      direction: "site_to_moysklad",
      status: "error",
      message,
    })

    console.error("[MoySklad] order sync failed:", message)
    return { error: message, trashed: isTrashedConflict }
  }
}
