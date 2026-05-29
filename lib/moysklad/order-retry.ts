import type { Payload } from "payload"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeProductDetailsSchema } from "@/lib/product-types"
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
  fullName?: string
  email?: string
  phone?: string | null
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
}

interface PayloadOrderDoc {
  id: string | number
  orderId?: string
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

async function getRetryCartItems(payload: Payload, order: PayloadOrderDoc): Promise<CartItem[]> {
  const adminDb = createAdminClient()
  const { data, error } = await adminDb
    .from("order_items")
    .select("id, order_id, product_id, variant_id, product_name, variant_name, grind_option, quantity, unit_price, total_price, weight_grams")
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
    })
  }

  return result
}

function buildDiscountLines(order: PayloadOrderDoc, cartItems: CartItem[]) {
  const subtotal = numberValue(order.subtotal)
  const discountAmount = numberValue(order.discountAmount)
  if (subtotal <= 0 || discountAmount <= 0) return []

  const discountPercent = Math.max(0, Math.min(100, (discountAmount / subtotal) * 100))
  return cartItems.map((item) => ({
    cartItemId: item.id,
    discountPercent,
  }))
}

function getClient(order: PayloadOrderDoc): PayloadClientDoc | null {
  return typeof order.client === "object" && order.client !== null ? order.client : null
}

async function retryOrder(payload: Payload, order: PayloadOrderDoc) {
  const client = getClient(order)
  if (!client) throw new Error("Клиент заказа не загружен для повтора МойСклад")

  const cartItems = await getRetryCartItems(payload, order)

  return syncOrderToMoysklad({
    payload,
    order: {
      id: order.id,
      orderId: order.orderId,
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
    company: order.companyName || order.companyInn ? {
      name: order.companyName || undefined,
      inn: order.companyInn || undefined,
    } : null,
    cartItems,
    discountLines: buildDiscountLines(order, cartItems),
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
