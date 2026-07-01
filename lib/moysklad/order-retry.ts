import type { Payload } from "payload"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeProductDetailsSchema } from "@/lib/product-types"
import { calculateClientDiscount, normalizeCategoryDiscounts, normalizeDiscountPercent, type CategoryDiscountRule } from "@/lib/discounts"
import { syncOrderToMoysklad } from "./sync"
import { writeMoyskladLog } from "./logs"
import type { CartItem, DeliveryMethod, Product, ProductDetailsSchema, ProductVariant } from "@/types"

const RETRY_INTERVAL_MS = 5 * 60 * 1000

interface RetryOptions {
  limit?: number
  minAgeMs?: number
  includeAllUnexported?: boolean
  includeExisting?: boolean
}

interface PayloadClientDoc {
  id?: string | number
  supabaseId?: string | null
  fullName?: string
  email?: string
  phone?: string | null
  moyskladCounterpartyId?: string | null
  discountPercent?: number | string | null
  categoryDiscounts?: {
    category?: { id?: string | number; name?: string } | string | number | null
    discountPercent?: number | string | null
  }[] | null
}

interface SupabaseCompanyRow {
  id: string
  name: string | null
  inn: string | null
  kpp?: string | null
  ogrn?: string | null
  legal_address?: string | null
  actual_address?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  moysklad_counterparty_id?: string | null
}

interface RetryCompany {
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

interface PayloadOrderItemDoc {
  id?: string | number
  productName?: string
  variantName?: string
  grindOption?: string | null
  quantity?: number | string
  unitPrice?: number | string
  totalPrice?: number | string
  stockProductMoyskladId?: string | null
  stockQuantityKg?: number | string | null
  stockPricePerKg?: number | string | null
  discountPercent?: number | string | null
  discountAmount?: number | string | null
}

interface PayloadOrderDoc {
  id: string | number
  orderId?: string
  createdAt?: string
  client?: PayloadClientDoc | string | number | null
  companyName?: string | null
  companyInn?: string | null
  deliveryMethod?: DeliveryMethod
  deliveryAddress?: string | null
  subtotal?: number | string
  discountAmount?: number | string
  deliveryCost?: number | string
  total?: number | string
  comment?: string | null
  moyskladCounterpartyId?: string | null
  moyskladCustomerOrderId?: string | null
  moyskladInvoiceOutId?: string | null
  moyskladSyncStatus?: string | null
  moyskladSyncError?: string | null
  updatedAt?: string
  items?: PayloadOrderItemDoc[]
}

interface OrderItemRow {
  id: string
  order_id: string
  product_id: string
  variant_id: string
  product_name: string | null
  variant_name: string | null
  grind_option: string | null
  quantity: number | string
  unit_price: number | string
  total_price: number | string
  discount_percent?: number | string | null
  discount_amount?: number | string | null
  weight_grams: number | string | null
}

interface PayloadVariantDoc {
  id?: string | number
  name?: string
  sku?: string | null
  moyskladId?: string | null
  moyskladType?: "product" | "variant" | "service" | null
  price?: number
  weightGrams?: number | null
  isAvailable?: boolean
  grindOptions?: string[]
}

interface PayloadProductDoc {
  id?: string | number
  category?: { id?: string | number } | string | number | null
  productTypeRef?: { name?: string; slug?: Product["product_type"]; detailsSchema?: ProductDetailsSchema } | string | number | null
  detailsSchema?: ProductDetailsSchema
  name?: string
  slug?: string
  moyskladId?: string | null
  sortOrder?: number
  isVisible?: boolean
  variants?: PayloadVariantDoc[]
  createdAt?: string
  updatedAt?: string
}

function numberValue(value: number | string | null | undefined) {
  return Number(value) || 0
}

function normalizeRetryDiscountPercent(value: unknown) {
  const numeric = Number(value) || 0
  return Math.max(0, Math.min(100, Math.round(numeric * 100) / 100))
}

function getRelationshipId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id
    return id === null || id === undefined ? null : String(id)
  }
  return String(value)
}

function getClientCategoryDiscounts(client: PayloadClientDoc): CategoryDiscountRule[] {
  const rules = (client.categoryDiscounts || [])
    .map((rule): CategoryDiscountRule | null => {
      const categoryId = getRelationshipId(rule.category)
      if (categoryId === null) return null

      return {
        categoryId,
        categoryName: typeof rule.category === "object" && rule.category !== null
          ? rule.category.name
          : undefined,
        discountPercent: normalizeDiscountPercent(rule.discountPercent),
      }
    })
    .filter((rule): rule is CategoryDiscountRule => rule !== null)

  return normalizeCategoryDiscounts(rules)
}

function normalizeText(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
}

function normalizeGrind(value?: string | null) {
  const normalized = normalizeText(value)
  if (!normalized) return ""
  if (normalized === "beans" || normalized.includes("зерн")) return "beans"
  if (normalized === "ground" || normalized.includes("молот")) return "ground"
  return normalized
}

function inferWeightGrams(value?: string | null) {
  const normalized = normalizeText(value).replace(",", ".")
  const kgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*кг/)
  if (kgMatch) return Math.round(Number(kgMatch[1]) * 1000)

  const gramMatch = normalized.match(/(\d+(?:\.\d+)?)\s*г/)
  if (gramMatch) return Math.round(Number(gramMatch[1]))

  return null
}

function getVariantMatchScore(variant: ProductVariant, row: OrderItemRow, unitPrice: number, weightGrams: number | null) {
  const variantName = normalizeText(variant.name)
  const rowVariantName = normalizeText(row.variant_name)
  const rowGrind = normalizeGrind(row.grind_option || row.variant_name)
  const variantGrinds = (variant.grind_options || []).map(normalizeGrind).filter(Boolean)
  let score = 0

  if (String(variant.id) === String(row.variant_id)) score += 100
  if (variantName && rowVariantName) {
    if (variantName === rowVariantName) score += 80
    else if (rowVariantName.includes(variantName) || variantName.includes(rowVariantName)) score += 40
  }

  if (weightGrams && variant.weight_grams && Number(variant.weight_grams) === Number(weightGrams)) score += 20
  if (unitPrice > 0 && Number(variant.price) === unitPrice) score += 20

  if (rowGrind && variantGrinds.includes(rowGrind)) score += 15

  if (variant.moysklad_id) score += 5
  return score
}

function resolveRetryVariant(product: Product | null, row: OrderItemRow, unitPrice: number, weightGrams: number | null) {
  if (!product?.variants?.length) return undefined

  const direct = product.variants.find((item) => String(item.id) === String(row.variant_id))
  if (direct?.moysklad_id) return direct

  const bestWithMoysklad = product.variants
    .filter((item) => item.moysklad_id)
    .map((item) => ({ item, score: getVariantMatchScore(item, row, unitPrice, weightGrams) }))
    .filter((match) => match.score >= 40)
    .sort((a, b) => b.score - a.score)[0]?.item

  return bestWithMoysklad || direct
}

function hasMoyskladError(order: PayloadOrderDoc) {
  return Boolean(order.moyskladSyncError?.trim())
}

function isUnexportedMoyskladOrder(order: PayloadOrderDoc) {
  return !order.moyskladCustomerOrderId?.trim()
}

function isRetryableMoyskladOrder(
  order: PayloadOrderDoc,
  includeAllUnexported = false,
  includeExisting = false
) {
  if (!isUnexportedMoyskladOrder(order)) return includeExisting
  if (includeAllUnexported) return true
  if (order.moyskladSyncStatus === "error") return true

  // Some failed creates were left as "pending" with a filled error field,
  // so treat them as stuck failed orders and keep retrying them too.
  return order.moyskladSyncStatus === "pending" && hasMoyskladError(order)
}

function isRetryDue(
  order: PayloadOrderDoc,
  minAgeMs: number,
  includeAllUnexported = false,
  includeExisting = false
) {
  if (!isRetryableMoyskladOrder(order, includeAllUnexported, includeExisting)) return false

  const updatedAt = order.updatedAt ? Date.parse(order.updatedAt) : 0
  if (!updatedAt) return true
  return Date.now() - updatedAt >= minAgeMs
}

function transformVariant(doc: PayloadVariantDoc, productId: string): ProductVariant {
  return {
    id: String(doc.id ?? ""),
    product_id: productId,
    name: doc.name || "",
    sku: doc.sku || null,
    moysklad_id: doc.moyskladId || null,
    moysklad_type: doc.moyskladType || null,
    price: numberValue(doc.price),
    weight_grams: doc.weightGrams ?? null,
    is_available: doc.isAvailable ?? true,
    sort_order: 0,
    grind_options: doc.grindOptions || [],
    created_at: "",
    updated_at: "",
  }
}

function transformProduct(doc: PayloadProductDoc): Product {
  const productId = String(doc.id ?? "")
  const categoryId = typeof doc.category === "object" && doc.category !== null ? doc.category.id : doc.category
  const typeRef = typeof doc.productTypeRef === "object" && doc.productTypeRef !== null ? doc.productTypeRef : null

  return {
    id: productId,
    category_id: categoryId === null || categoryId === undefined ? "" : String(categoryId),
    product_type: typeRef?.slug || "",
    product_type_name: typeRef?.name || typeRef?.slug || "",
    product_type_schema: normalizeProductDetailsSchema(typeRef?.detailsSchema || doc.detailsSchema),
    name: doc.name || "",
    slug: doc.slug || "",
    moysklad_id: doc.moyskladId || null,
    description: null,
    description_images: [],
    sort_order: doc.sortOrder || 0,
    is_visible: doc.isVisible ?? true,
    stickers: [],
    roaster: null,
    roast_level: null,
    region: null,
    processing_method: null,
    growing_height: null,
    q_grader_rating: null,
    brewing_instructions: null,
    brewing_methods: null,
    attached_files: null,
    images: [],
    video_urls: [],
    created_at: doc.createdAt || "",
    updated_at: doc.updatedAt || "",
    variants: (doc.variants || []).map((variant) => transformVariant(variant, productId)),
  }
}

async function getProduct(payload: Payload, id: string) {
  try {
    const product = await payload.findByID({
      collection: "products",
      id,
      depth: 2,
    })

    return transformProduct(product as PayloadProductDoc)
  } catch {
    return null
  }
}

async function findProductByMoyskladId(payload: Payload, moyskladId: string) {
  const result = await payload.find({
    collection: "products",
    where: { moyskladId: { equals: moyskladId } },
    limit: 1,
    depth: 2,
  })

  const product = result.docs[0] as PayloadProductDoc | undefined
  return product ? transformProduct(product) : null
}

async function findProductByName(payload: Payload, name: string) {
  const result = await payload.find({
    collection: "products",
    where: { name: { equals: name } },
    limit: 1,
    depth: 2,
  })

  const product = result.docs[0] as PayloadProductDoc | undefined
  return product ? transformProduct(product) : null
}

async function getProductForStoredOrderItem(
  payload: Payload,
  item: PayloadOrderItemDoc,
  productCache: Map<string, Product | null>
) {
  const stockProductMoyskladId = item.stockProductMoyskladId?.trim()
  const cacheKey = stockProductMoyskladId
    ? `moysklad:${stockProductMoyskladId}`
    : `name:${item.productName || ""}`

  const cached = productCache.get(cacheKey)
  if (cached !== undefined) return cached

  const product = stockProductMoyskladId
    ? await findProductByMoyskladId(payload, stockProductMoyskladId)
    : item.productName
      ? await findProductByName(payload, item.productName)
      : null

  productCache.set(cacheKey, product)
  return product
}

function buildCartItemFromStoredOrderItem(
  order: PayloadOrderDoc,
  item: PayloadOrderItemDoc,
  product: Product | null
): CartItem {
  const quantity = numberValue(item.quantity)
  const unitPrice = numberValue(item.unitPrice) || (quantity > 0 ? numberValue(item.totalPrice) / quantity : 0)
  const stockQuantityKg = numberValue(item.stockQuantityKg)
  const storedWeightGrams = stockQuantityKg > 0 && quantity > 0
    ? Math.round((stockQuantityKg / quantity) * 1000)
    : inferWeightGrams(item.variantName)
  const row: OrderItemRow = {
    id: String(item.id ?? `${order.id}-${item.productName || "item"}`),
    order_id: String(order.id),
    product_id: product?.id || item.stockProductMoyskladId || "",
    variant_id: "",
    product_name: item.productName || null,
    variant_name: item.variantName || null,
    grind_option: item.grindOption || null,
    quantity,
    unit_price: unitPrice,
    total_price: numberValue(item.totalPrice),
    discount_percent: item.discountPercent ?? null,
    discount_amount: item.discountAmount ?? null,
    weight_grams: storedWeightGrams,
  }
  const variant = resolveRetryVariant(product, row, unitPrice, storedWeightGrams)
  const weightGrams = storedWeightGrams ?? variant?.weight_grams ?? null
  const variantId = String(variant?.id ?? item.id ?? "")

  return {
    id: row.id,
    client_id: "",
    product_id: product?.id || row.product_id,
    variant_id: variantId,
    quantity,
    grind_option: item.grindOption || null,
    created_at: "",
    updated_at: "",
    product: product ? {
      ...product,
      name: product.name || item.productName || product.id,
    } : undefined,
    variant: product ? {
      ...(variant || {
        id: variantId,
        product_id: product.id,
        sku: null,
        moysklad_id: null,
        moysklad_type: null,
        is_available: true,
        sort_order: 0,
        grind_options: [],
        created_at: "",
        updated_at: "",
      }),
      id: variantId,
      name: item.variantName || variant?.name || variantId,
      price: unitPrice || variant?.price || 0,
      weight_grams: weightGrams,
    } : undefined,
  }
}

async function getRetryCartItemsFromStoredOrder(payload: Payload, order: PayloadOrderDoc) {
  const items = order.items || []
  if (items.length === 0 || !items.some((item) => item.stockProductMoyskladId?.trim())) return []

  const productCache = new Map<string, Product | null>()
  const result: CartItem[] = []

  for (const item of items) {
    const product = await getProductForStoredOrderItem(payload, item, productCache)
    result.push(buildCartItemFromStoredOrderItem(order, item, product))
  }

  return result
}

async function getRetryCartItems(payload: Payload, order: PayloadOrderDoc): Promise<CartItem[]> {
  const storedOrderItems = await getRetryCartItemsFromStoredOrder(payload, order)
  if (storedOrderItems.length > 0) return storedOrderItems

  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from("order_items")
    .select("id, order_id, product_id, variant_id, product_name, variant_name, grind_option, quantity, unit_price, total_price, discount_percent, discount_amount, weight_grams")
    .eq("order_id", String(order.id))
    .order("id", { ascending: true })

  if (error) throw new Error(`Не удалось прочитать позиции заказа для повтора МойСклад: ${error.message}`)

  const rows = (data || []) as OrderItemRow[]
  if (rows.length === 0) throw new Error("Нет сохранённых позиций заказа для повтора МойСклад")

  const productCache = new Map<string, Product | null>()
  const result: CartItem[] = []

  for (const row of rows) {
    let product = productCache.get(row.product_id)
    if (product === undefined) {
      product = await getProduct(payload, row.product_id)
      productCache.set(row.product_id, product)
    }

    const quantity = numberValue(row.quantity)
    const unitPrice = numberValue(row.unit_price) || (quantity > 0 ? numberValue(row.total_price) / quantity : 0)
    const directVariant = product?.variants?.find((item) => String(item.id) === String(row.variant_id))
    const storedWeightGrams = row.weight_grams == null ? null : numberValue(row.weight_grams)
    const weightGrams = storedWeightGrams ?? directVariant?.weight_grams ?? null
    const variant = resolveRetryVariant(product, row, unitPrice, weightGrams)
    const restoredVariant = product ? {
      ...(variant || {
        id: row.variant_id,
        product_id: row.product_id,
        sku: null,
        moysklad_id: null,
        moysklad_type: null,
        is_available: true,
        sort_order: 0,
        grind_options: [],
        created_at: "",
        updated_at: "",
      }),
      id: String(variant?.id ?? row.variant_id),
      name: row.variant_name || variant?.name || row.variant_id,
      price: unitPrice || variant?.price || 0,
      weight_grams: weightGrams,
    } : undefined

    result.push({
      id: row.id,
      client_id: "",
      product_id: row.product_id,
      variant_id: row.variant_id,
      quantity,
      grind_option: row.grind_option || null,
      created_at: "",
      updated_at: "",
      product: product ? {
        ...product,
        name: product.name || row.product_name || row.product_id,
      } : undefined,
      variant: restoredVariant,
      discount_percent: row.discount_percent,
    } as CartItem & { discount_percent?: number | string | null })
  }

  return result
}

function buildStoredDiscountLines(order: PayloadOrderDoc, cartItems: CartItem[]) {
  const orderItemDiscounts = new Map(
    (order.items || [])
      .map((item) => [String(item.id ?? ""), normalizeRetryDiscountPercent(item.discountPercent)]) as [string, number][]
  )
  const lines = cartItems
    .map((item) => ({
      cartItemId: item.id,
      discountPercent: orderItemDiscounts.get(item.id) || normalizeRetryDiscountPercent((item as { discount_percent?: unknown }).discount_percent),
    }))
    .filter((line) => line.discountPercent > 0)

  return lines.length > 0 ? lines : null
}

function buildDiscountLines(order: PayloadOrderDoc, cartItems: CartItem[], client: PayloadClientDoc) {
  const subtotal = numberValue(order.subtotal)
  const discountAmount = numberValue(order.discountAmount)
  if (subtotal <= 0 || discountAmount <= 0) return []

  const storedLines = buildStoredDiscountLines(order, cartItems)
  if (storedLines) return storedLines

  const recalculatedClientDiscount = calculateClientDiscount(cartItems, {
    discountPercent: normalizeDiscountPercent(client.discountPercent),
    categoryDiscounts: getClientCategoryDiscounts(client),
  })
  if (recalculatedClientDiscount.amount === discountAmount && recalculatedClientDiscount.lines.length > 0) {
    return recalculatedClientDiscount.lines.map((line) => ({
      cartItemId: line.cartItemId,
      discountPercent: normalizeRetryDiscountPercent(line.discountPercent),
    }))
  }

  const discountPercent = normalizeRetryDiscountPercent((discountAmount / subtotal) * 100)
  return cartItems.map((item) => ({
    cartItemId: item.id,
    discountPercent,
  }))
}

function getClient(order: PayloadOrderDoc): PayloadClientDoc | null {
  return typeof order.client === "object" && order.client !== null ? order.client : null
}

async function getRetryClient(payload: Payload, order: PayloadOrderDoc): Promise<PayloadClientDoc | null> {
  const clientRef = order.client
  const clientId = typeof clientRef === "object" && clientRef !== null
    ? clientRef.id
    : clientRef

  if (!clientId) return getClient(order)

  try {
    const loaded = await payload.findByID({
      collection: "clients",
      id: clientId,
      depth: 0,
    }) as PayloadClientDoc

    return {
      ...(typeof clientRef === "object" && clientRef !== null ? clientRef : {}),
      ...loaded,
      moyskladCounterpartyId: loaded.moyskladCounterpartyId
        || (typeof clientRef === "object" && clientRef !== null ? clientRef.moyskladCounterpartyId : null)
        || order.moyskladCounterpartyId
        || null,
    }
  } catch {
    const client = getClient(order)
    return client ? {
      ...client,
      moyskladCounterpartyId: client.moyskladCounterpartyId || order.moyskladCounterpartyId || null,
    } : null
  }
}

function mapSupabaseCompanyToRetryCompany(company: SupabaseCompanyRow): RetryCompany {
  return {
    id: company.id,
    name: company.name || undefined,
    inn: company.inn || undefined,
    kpp: company.kpp || null,
    ogrn: company.ogrn || null,
    legalAddress: company.legal_address || null,
    actualAddress: company.actual_address || null,
    contactPhone: company.contact_phone || null,
    contactEmail: company.contact_email || null,
    moyskladCounterpartyId: company.moysklad_counterparty_id || null,
  }
}

async function getRetryCompany(order: PayloadOrderDoc, client: PayloadClientDoc): Promise<RetryCompany | null> {
  if (!order.companyName && !order.companyInn) return null

  const adminDb = createAdminClient()
  let query = adminDb
    .from("companies")
    .select("id, name, inn, kpp, ogrn, legal_address, actual_address, contact_phone, contact_email, moysklad_counterparty_id")
    .limit(1)

  if (order.companyInn) {
    query = query.eq("inn", order.companyInn)
  } else {
    query = query.eq("name", order.companyName || "")
  }

  if (client.supabaseId) {
    query = query.eq("client_id", client.supabaseId)
  }

  const { data } = await query.maybeSingle<SupabaseCompanyRow>()
  if (data) return mapSupabaseCompanyToRetryCompany(data)

  return {
    name: order.companyName || undefined,
    inn: order.companyInn || undefined,
    contactPhone: client.phone || null,
    contactEmail: client.email || null,
    moyskladCounterpartyId: order.moyskladCounterpartyId || null,
  }
}

async function retryOrder(payload: Payload, order: PayloadOrderDoc) {
  const client = await getRetryClient(payload, order)
  if (!client) throw new Error("Клиент заказа не загружен для повтора МойСклад")

  const [cartItems, company] = await Promise.all([
    getRetryCartItems(payload, order),
    getRetryCompany(order, client),
  ])

  return syncOrderToMoysklad({
    payload,
    order: {
      id: order.id,
      orderId: order.orderId,
      createdAt: order.createdAt,
      subtotal: numberValue(order.subtotal),
      discountAmount: numberValue(order.discountAmount),
      deliveryCost: numberValue(order.deliveryCost),
      total: numberValue(order.total),
      deliveryMethod: order.deliveryMethod,
      deliveryAddress: order.deliveryAddress || "",
      comment: order.comment || "",
      moyskladCustomerOrderId: order.moyskladCustomerOrderId || null,
      moyskladInvoiceOutId: order.moyskladInvoiceOutId || null,
    },
    client: {
      id: client.id,
      fullName: client.fullName,
      email: client.email || "",
      phone: client.phone || null,
      moyskladCounterpartyId: client.moyskladCounterpartyId || null,
    },
    company,
    cartItems,
    discountLines: buildDiscountLines(order, cartItems, client),
  })
}

export async function retryFailedMoyskladOrders(payload: Payload, options: RetryOptions = {}) {
  const limit = options.limit || (options.includeAllUnexported ? 100 : 25)
  const minAgeMs = options.minAgeMs ?? RETRY_INTERVAL_MS
  const includeAllUnexported = options.includeAllUnexported || false
  const includeExisting = options.includeExisting || false
  const where = includeAllUnexported || includeExisting
    ? undefined
    : {
        or: [
          { moyskladSyncStatus: { equals: "error" } },
          { moyskladSyncStatus: { equals: "pending" } },
        ],
      }

  const orders: PayloadOrderDoc[] = []
  let page = 1
  let totalPages = 1

  do {
    const result = await payload.find({
      collection: "orders",
      where,
      sort: "updatedAt",
      limit,
      page,
      depth: 1,
    })

    orders.push(...(result.docs as PayloadOrderDoc[]))
    totalPages = Number(result.totalPages) || 1
    page += 1
  } while ((includeAllUnexported || includeExisting) && page <= totalPages)

  const retryable = orders.filter((order) => isRetryableMoyskladOrder(order, includeAllUnexported, includeExisting))
  const candidates = retryable.filter((order) => isRetryDue(order, minAgeMs, includeAllUnexported, includeExisting))
  const retried: { id: string | number; orderId?: string; success: boolean; error?: string }[] = []

  for (const order of candidates) {
    try {
      const syncResult = await retryOrder(payload, order)
      if ("error" in syncResult && syncResult.error) {
        retried.push({ id: order.id, orderId: order.orderId, success: false, error: syncResult.error })
      } else {
        retried.push({ id: order.id, orderId: order.orderId, success: true })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось повторить синхронизацию заказа с МойСклад"
      retried.push({ id: order.id, orderId: order.orderId, success: false, error: message })

      await payload.update({
        collection: "orders",
        id: order.id,
        data: {
          moyskladSyncStatus: "error",
          moyskladSyncError: message,
        },
      })

      await writeMoyskladLog({
        entityType: "order",
        localId: order.id,
        direction: "site_to_moysklad",
        status: "error",
        message,
      })
    }
  }

  return {
    checked: orders.length,
    retryable: retryable.length,
    due: candidates.length,
    retried,
    succeeded: retried.filter((item) => item.success).length,
    failed: retried.filter((item) => !item.success).length,
  }
}
