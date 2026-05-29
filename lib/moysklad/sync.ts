import type { Payload } from "payload"
import { dbQuery } from "@/lib/db"
import { getMoyskladConfig, assertMoyskladReady } from "./config"
import { extractMoyskladId, moyskladGetList, moyskladMeta, moyskladRequest } from "./client"
import { writeMoyskladLog } from "./logs"
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
  moyskladStockLossId?: string | null
  items?: PayloadOrderStockLossItem[]
}

const kilogramProductCache = new Map<string, Promise<boolean>>()
const bundleCache = new Map<string, Promise<MoyskladBundleForOrder>>()

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

async function ensureB2bMoyskladSchema() {
  await dbQuery(`
    alter table public.companies
      add column if not exists moysklad_counterparty_id text;
    create index if not exists companies_moysklad_counterparty_id_idx
      on public.companies(moysklad_counterparty_id);
    alter table public.orders
      add column if not exists moysklad_counterparty_id varchar,
      add column if not exists moysklad_invoice_out_id varchar,
      add column if not exists moysklad_stock_loss_id varchar,
      add column if not exists moysklad_stock_loss_synced_at timestamptz,
      add column if not exists moysklad_stock_loss_error text;
    create index if not exists orders_moysklad_counterparty_id_idx
      on public.orders(moysklad_counterparty_id);
    create index if not exists orders_moysklad_invoice_out_id_idx
      on public.orders(moysklad_invoice_out_id);
    create index if not exists orders_moysklad_stock_loss_id_idx
      on public.orders(moysklad_stock_loss_id);
  `)
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
  await ensureB2bMoyskladSchema()
  await dbQuery(
    "update public.companies set moysklad_counterparty_id = $1, updated_at = now() where id = $2",
    [counterpartyId, companyId]
  )
}

async function clearCompanyCounterpartyId(companyId: string | undefined) {
  if (!companyId) return
  await ensureB2bMoyskladSchema()
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

async function ensureCounterparty(payload: Payload, client: SyncClient, company?: SyncCompany | null) {
  const config = getMoyskladConfig()
  assertMoyskladReady(config)

  if (company) {
    if (company.moyskladCounterpartyId) {
      const linkedCounterparty = await findCounterpartyById(company.moyskladCounterpartyId).catch(() => null)
      const linkedInn = normalizeInn(linkedCounterparty?.inn)
      const companyInn = normalizeInn(company.inn)

      if (!companyInn || linkedInn === companyInn) {
        return company.moyskladCounterpartyId
      }

      await clearCompanyCounterpartyId(company.id)
    }

    if (company.inn) {
      const existing = await findCounterpartyByInn(company.inn)
      const existingId = extractMoyskladId(existing)
      if (existingId) {
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
    return client.moyskladCounterpartyId
  }

  if (client.email) {
    const existing = await findCounterpartyByEmail(client.email)
    const existingId = extractMoyskladId(existing)
    if (existingId) {
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

async function ensureSalesChannel() {
  const config = getMoyskladConfig()
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
      type: "ECOMMERCE",
      description: "Автоматически создано для заказов сайта 10coffee",
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
  return Boolean(productMoyskladId && isCoffeeWeightAccountingItem(item))
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
  discountLines: MoyskladDiscountLine[] = []
) {
  const config = getMoyskladConfig()
  const discountByItem = new Map(
    discountLines.map((line) => [
      line.cartItemId,
      Math.max(0, Math.min(100, Math.round(line.discountPercent))),
    ])
  )

  const skipped: CartItem[] = []
  const positions: MoyskladOrderPositionPayload[] = []
  const compositionLines: string[] = []
  const weightPositions = new Map<string, MoyskladOrderPositionPayload>()

  for (const item of cartItems) {
    const productMoyskladId = item.product?.moysklad_id || null
    const weightGrams = Number(item.variant?.weight_grams) || 0

    if (
      productMoyskladId &&
      shouldUseBundleAccounting(item, productMoyskladId) &&
      await isKilogramProduct(productMoyskladId)
    ) {
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
      if (config.defaultVat > 0) position.vat = config.defaultVat

      positions.push(position)
      compositionLines.push(
        `${item.product?.name || item.product_id}: ${item.variant?.name || item.variant_id}${getCartItemGrindLabel(item)} ×${item.quantity} (${formatWeightFromGrams(weightGrams * item.quantity)})`
      )
      continue
    }

    const shouldUseWeightAccounting =
      isCoffeeWeightAccountingItem(item) &&
      productMoyskladId &&
      await isKilogramProduct(productMoyskladId)

    if (shouldUseWeightAccounting) {
      const weightKgPerPack = weightGrams / 1000
      const quantityKg = weightKgPerPack * item.quantity
      const variantPriceKopecks = rubToKopecks(item.variant?.price ?? 0)
      const pricePerKg = weightKgPerPack > 0
        ? Math.round(variantPriceKopecks / weightKgPerPack)
        : 0

      if (quantityKg <= 0 || pricePerKg <= 0) {
        skipped.push(item)
        continue
      }

      const discount = discountByItem.get(item.id) || 0
      const key = [
        productMoyskladId,
        pricePerKg,
        discount,
        config.defaultVat,
      ].join(":")
      const existing = weightPositions.get(key)

      if (existing) {
        existing.quantity = Number((existing.quantity + quantityKg).toFixed(6))
      } else {
        const position: MoyskladOrderPositionPayload = {
          quantity: Number(quantityKg.toFixed(6)),
          price: pricePerKg,
          assortment: {
            meta: moyskladMeta("product", productMoyskladId),
          },
        }

        if (discount > 0) position.discount = discount
        if (config.defaultVat > 0) position.vat = config.defaultVat

        weightPositions.set(key, position)
        positions.push(position)
      }

      compositionLines.push(
        `${item.product?.name || item.product_id}: ${item.variant?.name || item.variant_id}${getCartItemGrindLabel(item)} ×${item.quantity} (${formatWeightFromGrams(weightGrams * item.quantity)})`
      )
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
    if (config.defaultVat > 0) position.vat = config.defaultVat

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

    if (config.defaultVat > 0) deliveryPosition.vat = config.defaultVat
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
}) {
  const config = getMoyskladConfig()
  const body: Record<string, unknown> = {
    moment: formatMoment(),
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

async function createInvoiceOut(params: {
  order: SyncOrder
  counterpartyId: string
  moyskladOrderId: string
  positions: MoyskladOrderPositionPayload[]
  description: string
  shipmentAddress?: string | null
  salesChannelId?: string | null
}) {
  const externalCode = `${params.order.orderId || params.order.id}-invoice`
  const invoiceBody = {
    ...buildDocumentRefs({
      counterpartyId: params.counterpartyId,
      positions: params.positions,
      description: params.description,
      shipmentAddress: params.shipmentAddress,
      salesChannelId: params.salesChannelId,
    }),
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
  }

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

  await ensureB2bMoyskladSchema()

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

  const body = {
    moment: formatMoment(),
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
  const config = getMoyskladConfig()
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

    await ensureB2bMoyskladSchema()

    const counterpartyId = await ensureCounterparty(params.payload, params.client, params.company)
    counterpartyIdForUpdate = counterpartyId
    const salesChannelId = await ensureSalesChannel()
    const { positions, skipped, compositionLines } = await buildCustomerPositions(
      params.cartItems,
      Number(params.order.deliveryCost) || 0,
      params.discountLines || []
    )

    if (skipped.length > 0) {
      const names = skipped.map((item) => `${item.product?.name || item.product_id} / ${item.variant?.name || item.variant_id}`)
      throw new Error(`Не заполнен moyskladId у позиций: ${names.join(", ")}`)
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
      }),
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
      orderResponse = await moyskladRequest<MoyskladCustomerOrder>(`entity/customerorder/${moyskladOrderId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      })
      orderMessage = "Заказ уже существовал в МойСклад, позиции и суммы обновлены"
    } else {
      orderResponse = await moyskladRequest<MoyskladCustomerOrder>("entity/customerorder", {
        method: "POST",
        body: JSON.stringify(body),
      })
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

    if (config.createInvoiceOnOrder && moyskladOrderId) {
      const invoiceResult = await createInvoiceOut({
        order: params.order,
        counterpartyId,
        moyskladOrderId,
        positions,
        description,
        shipmentAddress: params.order.deliveryAddress,
        salesChannelId,
      })
      moyskladInvoiceOutId = invoiceResult.invoiceId
      moyskladInvoiceOutIdForUpdate = moyskladInvoiceOutId
      invoiceResponse = invoiceResult.invoice
      invoicePayload = invoiceResult.payload
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
    return { error: message }
  }
}
