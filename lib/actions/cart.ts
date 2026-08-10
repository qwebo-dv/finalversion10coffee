"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { createClient } from "@/lib/supabase/server"
import { getMediaUrl, type PayloadMediaRef as MediaUrlRef } from "@/lib/media"
import { normalizeProductDetailsSchema } from "@/lib/product-types"
import type { CartItem, Product, ProductVariant, ProductTag, ProductDetailsSchema } from "@/types"

async function getPayloadClient() {
  return getPayload({ config: configPromise })
}

async function incrementCartItem(params: {
  clientId: string
  productId: number
  variantId: string
  grindOption: string
  quantity: number
}) {
  const payload = await getPayloadClient()

  for (let attempt = 0; attempt < 5; attempt++) {
    const { docs } = await payload.find({
      collection: "cart-items",
      where: {
        and: [
          { clientId: { equals: params.clientId } },
          { product: { equals: params.productId } },
          { variantId: { equals: params.variantId } },
          { grindOption: { equals: params.grindOption } },
        ],
      },
      limit: 1,
      depth: 0,
    })
    const existing = docs[0]

    if (existing) {
      const currentQuantity = Number(existing.quantity) || 0
      const updated = await payload.update({
        collection: "cart-items",
        where: {
          and: [
            { id: { equals: existing.id } },
            { quantity: { equals: currentQuantity } },
          ],
        },
        data: { quantity: currentQuantity + params.quantity },
        depth: 0,
      })
      if (updated.docs.length > 0) return
      continue
    }

    try {
      await payload.create({
        collection: "cart-items",
        data: {
          clientId: params.clientId,
          product: params.productId,
          variantId: params.variantId,
          quantity: params.quantity,
          grindOption: params.grindOption,
        },
      })
      return
    } catch (error) {
      // A concurrent request may have inserted the unique cart line. Retry as
      // an update; validation errors will consistently fail all attempts.
      if (attempt === 4) throw error
    }
  }

  throw new Error("Не удалось обновить корзину после нескольких попыток")
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

// ============================================================
// Transform helpers
// ============================================================

const GRIND_MAP: Record<string, string> = {
  beans: "В зёрнах",
  ground: "Молотый",
}

interface PayloadMedia {
  url?: string
  sizes?: {
    card?: { url?: string }
    full?: { url?: string }
  }
}

type PayloadMediaRef = PayloadMedia | string | number | null | undefined

interface PayloadTag {
  id?: string | number
  name?: string
  slug?: string
  color?: string
}

interface PayloadVariant {
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

interface PayloadProductTypeDoc {
  name?: string
  slug?: Product["product_type"]
  detailsSchema?: ProductDetailsSchema
}

interface PayloadCategoryRef {
  id?: string | number
  parent?: PayloadCategoryRef | string | number | null
}

interface PayloadProductDoc {
  id?: string | number
  category?: PayloadCategoryRef | string | number | null
  productTypeRef?: PayloadProductTypeDoc | string | number | null
  detailsSchema?: ProductDetailsSchema
  name?: string
  slug?: string
  moyskladId?: string | null
  sortOrder?: number
  isVisible?: boolean
  stickers?: (PayloadTag | string | number | null)[]
  coffeeDetails?: {
    roaster?: string
    roastLevel?: string
    country?: string
    region?: string
    processingMethod?: string
    tasteDescription?: string
    acidity?: number
    brewGroup?: "espresso" | "filter" | "drip"
    growingHeight?: string
    qGraderRating?: number
    brewingMethods?: {
      method?: string
      description?: string
    }[]
  }
  teaDetails?: {
    brewingInstructions?: {
      title?: string
      text?: string
    }[]
  }
  images?: { image?: PayloadMediaRef }[]
  videoUrls?: { url?: string }[]
  variants?: PayloadVariant[]
  createdAt?: string
  updatedAt?: string
}

interface PayloadCartItemDoc {
  id?: string | number
  clientId?: string
  product?: PayloadProductDoc | string | number | null
  variantId?: string
  quantity?: number
  grindOption?: string | null
  createdAt?: string
  updatedAt?: string
}

function isPayloadMedia(value: PayloadMediaRef): value is PayloadMedia {
  return typeof value === "object" && value !== null
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value)
}

function normalizeTagColor(color: string | undefined): ProductTag["color"] {
  const value = color?.trim()
  return value ? value : undefined
}

function transformTag(tag: PayloadTag | string | number | null): ProductTag | null {
  if (!tag || typeof tag !== "object") return null
  return {
    id: String(tag.id ?? ""),
    name: tag.name || "",
    slug: tag.slug || "",
    color: normalizeTagColor(tag.color),
  }
}


function getRelationshipId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id
    return id === null || id === undefined ? null : String(id)
  }
  return String(value)
}

function getCategoryIds(category: PayloadProductDoc["category"]): string[] {
  const result: string[] = []
  let current: unknown = category

  while (current !== null && current !== undefined) {
    const id = getRelationshipId(current)
    if (!id || result.includes(id)) break
    result.push(id)

    if (typeof current !== "object") break
    current = (current as PayloadCategoryRef).parent
  }

  return result
}

function resolveProductType(doc: PayloadProductDoc): Product["product_type"] {
  const typeRef = doc.productTypeRef
  if (typeRef && typeof typeRef === "object" && typeRef.slug) {
    return typeRef.slug
  }
  return ""
}

function resolveProductTypeName(doc: PayloadProductDoc): string {
  const typeRef = doc.productTypeRef
  if (typeRef && typeof typeRef === "object") {
    return typeRef.name || typeRef.slug || ""
  }
  return ""
}

function resolveProductTypeSchema(doc: PayloadProductDoc): ProductDetailsSchema {
  const typeRef = doc.productTypeRef
  if (typeRef && typeof typeRef === "object") {
    return normalizeProductDetailsSchema(typeRef.detailsSchema)
  }
  return normalizeProductDetailsSchema(doc.detailsSchema)
}

function extractImageUrls(images: { image?: PayloadMediaRef }[] | undefined | null): string[] {
  if (!images || !Array.isArray(images)) return []
  return images
    .map((entry) => {
      const img = entry?.image
      if (!isPayloadMedia(img)) return null
      return getMediaUrl(img as MediaUrlRef, ["full", "card", "thumbnail"])
    })
    .filter(isDefined)
}

function transformVariantFromPayload(v: PayloadVariant, productId: string): ProductVariant {
  return {
    id: String(v.id ?? ""),
    product_id: productId,
    name: v.name || "",
    sku: v.sku || null,
    moysklad_id: v.moyskladId || null,
    moysklad_type: v.moyskladType || null,
    price: v.price || 0,
    weight_grams: v.weightGrams ?? null,
    is_available: v.isAvailable ?? true,
    sort_order: 0,
    grind_options: (v.grindOptions || []).map((g: string) => GRIND_MAP[g] || g),
    created_at: "",
    updated_at: "",
  }
}

function transformProductFromPayload(doc: PayloadProductDoc): Product {
  const productId = String(doc.id)
  const categoryIds = getCategoryIds(doc.category)
  const categoryId = categoryIds[0] || ""
  const coffee = doc.coffeeDetails || {}
  const tea = doc.teaDetails || {}

  return {
    id: productId,
    category_id: categoryId,
    category_ids: categoryIds,
    product_type: resolveProductType(doc),
    product_type_name: resolveProductTypeName(doc),
    product_type_schema: resolveProductTypeSchema(doc),
    name: doc.name || "",
    slug: doc.slug || "",
    moysklad_id: doc.moyskladId || null,
    description: null,
    description_images: [],
    sort_order: doc.sortOrder || 0,
    is_visible: doc.isVisible ?? true,
    stickers: (doc.stickers || []).map(transformTag).filter(isDefined),
    roaster: coffee.roaster || null,
    roast_level: coffee.roastLevel || null,
    country: coffee.country || null,
    region: coffee.region || null,
    processing_method: coffee.processingMethod || null,
    taste_description: coffee.tasteDescription || null,
    acidity: typeof coffee.acidity === "number" ? coffee.acidity : null,
    coffee_group: coffee.brewGroup || null,
    growing_height: coffee.growingHeight || null,
    q_grader_rating: coffee.qGraderRating || null,
    brewing_methods: (coffee.brewingMethods || []).map((m) => ({
      method: m.method || "",
      description: m.description || "",
    })),
    brewing_instructions: (tea.brewingInstructions || []).map((i) => ({
      title: i.title || "",
      text: i.text || "",
    })),
    attached_files: null,
    images: extractImageUrls(doc.images),
    video_urls: (doc.videoUrls || []).map((v) => v.url).filter(isNonEmptyString),
    created_at: doc.createdAt || "",
    updated_at: doc.updatedAt || "",
    variants: (doc.variants || []).map((v) => transformVariantFromPayload(v, productId)),
  }
}

function transformCartItem(doc: PayloadCartItemDoc): CartItem {
  const rawProduct = typeof doc.product === "object" ? doc.product : null
  const rawProductId = rawProduct?.id ?? (typeof doc.product === "object" ? undefined : doc.product)
  const product = rawProduct ? transformProductFromPayload(rawProduct) : undefined
  const variant = product?.variants?.find((v) => v.id === doc.variantId) || undefined

  return {
    id: String(doc.id),
    client_id: doc.clientId || "",
    product_id: rawProductId === null || rawProductId === undefined ? "" : String(rawProductId),
    variant_id: doc.variantId || "",
    quantity: doc.quantity || 0,
    grind_option: doc.grindOption || null,
    created_at: doc.createdAt || "",
    updated_at: doc.updatedAt || "",
    product,
    variant,
  }
}

// ============================================================
// Cart CRUD — reads via Payload (needs JOINs), mutations via Supabase
// ============================================================

export async function getCartItems(): Promise<CartItem[]> {
  const clientId = await getCurrentUserId()
  if (!clientId) return []

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "cart-items",
    where: { clientId: { equals: clientId } },
    depth: 2,
    limit: 100,
    sort: "createdAt",
  })

  return (docs as PayloadCartItemDoc[]).map(transformCartItem)
}

export async function addToCart(params: {
  productId: string
  variantId: string
  quantity: number
  grindOption?: string
}): Promise<{ success: boolean }> {
  const clientId = await getCurrentUserId()
  if (!clientId) return { success: false }

  const productId = Number(params.productId)
  if (!Number.isInteger(productId) || productId <= 0 || params.quantity <= 0) {
    return { success: false }
  }
  const grindOption = params.grindOption || ""
  await incrementCartItem({
    clientId,
    productId,
    variantId: params.variantId,
    quantity: params.quantity,
    grindOption,
  })

  return { success: true }
}

export async function updateCartQuantity(
  cartItemId: string,
  quantity: number
): Promise<{ success: boolean }> {
  if (quantity < 1) return { success: false }

  const clientId = await getCurrentUserId()
  if (!clientId) return { success: false }
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "cart-items",
    where: { and: [{ id: { equals: cartItemId } }, { clientId: { equals: clientId } }] },
    limit: 1,
    depth: 0,
  })
  if (!docs[0]) return { success: false }
  await payload.update({ collection: "cart-items", id: docs[0].id, data: { quantity } })

  return { success: true }
}

export async function removeCartItem(cartItemId: string): Promise<{ success: boolean }> {
  const clientId = await getCurrentUserId()
  if (!clientId) return { success: false }
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "cart-items",
    where: { and: [{ id: { equals: cartItemId } }, { clientId: { equals: clientId } }] },
    limit: 1,
    depth: 0,
  })
  if (!docs[0]) return { success: false }
  await payload.delete({ collection: "cart-items", id: docs[0].id })

  return { success: true }
}

export async function clearCart(): Promise<{ success: boolean }> {
  const clientId = await getCurrentUserId()
  if (!clientId) return { success: false }

  const payload = await getPayloadClient()
  await payload.delete({
    collection: "cart-items",
    where: { clientId: { equals: clientId } },
  })

  return { success: true }
}
