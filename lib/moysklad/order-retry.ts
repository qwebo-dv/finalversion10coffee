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

function hasMoyskladError(order: PayloadOrderDoc) {
  return Boolean(order.moyskladSyncError?.trim())
}

function isRetryableMoyskladOrder(order: PayloadOrderDoc) {
  if (order.moyskladCustomerOrderId) return false
  if (order.moyskladSyncStatus === "error") return true

  // Some failed creates were left as "pending" with a filled error field,
  // so treat them as stuck failed orders and keep retrying them too.
  return order.moyskladSyncStatus === "pending" && hasMoyskladError(order)
}

function isRetryDue(order: PayloadOrderDoc, minAgeMs: number) {
  if (!isRetryableMoyskladOrder(order)) return false

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

    const variant = product?.variants?.find((item) => item.id === row.variant_id)
    const quantity = numberValue(row.quantity)
    const unitPrice = numberValue(row.unit_price)

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
      variant: variant ? {
        ...variant,
        name: variant.name || row.variant_name || row.variant_id,
        price: unitPrice || variant.price,
        weight_grams: row.weight_grams === null ? variant.weight_grams : numberValue(row.weight_grams),
      } : undefined,
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
  const limit = options.limit || 25
  const minAgeMs = options.minAgeMs ?? RETRY_INTERVAL_MS

  const result = await payload.find({
    collection: "orders",
    where: {
      or: [
        { moyskladSyncStatus: { equals: "error" } },
        { moyskladSyncStatus: { equals: "pending" } },
      ],
    },
    sort: "updatedAt",
    limit,
    depth: 1,
  })

  const retryable = (result.docs as PayloadOrderDoc[]).filter(isRetryableMoyskladOrder)
  const candidates = retryable.filter((order) => isRetryDue(order, minAgeMs))
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
    checked: result.docs.length,
    retryable: retryable.length,
    due: candidates.length,
    retried,
    succeeded: retried.filter((item) => item.success).length,
    failed: retried.filter((item) => !item.success).length,
  }
}
