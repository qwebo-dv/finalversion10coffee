"use server"

import { getPayload, type Where } from "payload"
import configPromise from "@payload-config"
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { createClient } from "@/lib/supabase/server"
import type { CustomerSessionScope } from "@/lib/auth/constants"
import { getMediaUrl, type PayloadMediaRef as MediaUrlRef } from "@/lib/media"
import { getRelationshipId, normalizeProductDetailsSchema } from "@/lib/product-types"
import {
  EMPTY_CLIENT_DISCOUNT_CONFIG,
  normalizeCategoryDiscounts,
  normalizeDiscountPercent,
  normalizeProductDiscounts,
  type CategoryDiscountRule,
  type ClientDiscountConfig,
  type ProductDiscountRule,
} from "@/lib/discounts"
import type { Product, ProductVariant, ProductType, ProductTypeOption, ProductTag, AttachedFile, ProductDetailsSchema, ProductReview } from "@/types"

async function getPayloadClient() {
  return getPayload({ config: configPromise })
}

async function getCurrentUserId(sessionScope?: CustomerSessionScope): Promise<string | null> {
  try {
    const supabase = await createClient(sessionScope)
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

// ============================================================
// Transform helpers: Payload → Frontend types
// ============================================================

const GRIND_MAP: Record<string, string> = {
  beans: "В зёрнах",
  ground: "Молотый",
}

interface PayloadMedia {
  url?: string
  filename?: string
  filesize?: number
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
  price?: number
  weightGrams?: number | null
  isAvailable?: boolean
  grindOptions?: string[]
}

interface PayloadProductTypeDoc {
  id?: string | number
  name?: string
  slug?: ProductType
  detailsSchema?: ProductDetailsSchema
  icon?: PayloadMediaRef
  sortOrder?: number
  isVisible?: boolean
  isPopular?: boolean
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
  description?: SerializedEditorState | string | null
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
    bitterness?: number
    sweetness?: number
    body?: number
    brewGroup?: "espresso" | "filter" | "drip"
    growingHeight?: string
    qGraderRating?: number
    brewingMethods?: {
      method?: string
      description?: string
      image?: PayloadMediaRef
    }[]
  }
  teaDetails?: {
    brewingInstructions?: {
      title?: string
      text?: string
      image?: PayloadMediaRef
    }[]
  }
  attachedFiles?: {
    label?: string
    file?: PayloadMediaRef
  }[]
  images?: { image?: PayloadMediaRef }[]
  videoUrls?: { url?: string }[]
  variants?: PayloadVariant[]
  createdAt?: string
  updatedAt?: string
  manualRating?: number
  manualRatingCount?: number
}

interface PayloadReviewDoc {
  id?: string | number
  product?: PayloadProductDoc | string | number | null
  authorName?: string
  authorClient?: { id?: string | number; fullName?: string | null } | string | number | null
  clientId?: string | null
  rating?: number
  comment?: string
  createdAt?: string
  status?: "pending" | "approved" | "rejected" | string | null
}

interface PayloadClientCategoryDiscount {
  category?: { id?: string | number; name?: string } | string | number | null
  discountPercent?: number | string | null
}

interface PayloadClientProductDiscount {
  products?: ({ id?: string | number; name?: string } | string | number)[] | null
  discountPercent?: number | string | null
}

interface PayloadClientDiscountDoc {
  discountPercent?: number | string | null
  categoryDiscounts?: PayloadClientCategoryDiscount[] | null
  productDiscounts?: PayloadClientProductDiscount[] | null
}

interface PayloadCategoryDoc {
  id: number
  name: string
  image?: PayloadMediaRef
  productTypeRef?: PayloadProductTypeDoc | string | number | null
  parent?: { id?: number } | number | null
  children?: PayloadCategoryDoc[]
}

interface CatalogCategoryDoc {
  id: number
  name: string
  image?: PayloadMedia | null
  children?: CatalogCategoryDoc[]
}

interface PayloadFavoriteDoc {
  product?: { id?: string | number } | string | number | null
}

interface PayloadTagDoc {
  id?: string | number
  name?: string
  slug?: string
  color?: string
}


function getCategoryIds(category: PayloadProductDoc["category"]): string[] {
  const result: string[] = []
  let current: unknown = category

  while (current !== null && current !== undefined) {
    const rawId = getRelationshipId(current)
    const id = rawId === null ? "" : String(rawId)
    if (!id || result.includes(id)) break
    result.push(id)

    if (typeof current !== "object") break
    current = (current as PayloadCategoryRef).parent
  }

  return result
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

function transformVariant(v: PayloadVariant, productId: string): ProductVariant {
  return {
    id: String(v.id ?? ""),
    product_id: productId,
    name: v.name || "",
    sku: v.sku || null,
    price: v.price || 0,
    weight_grams: v.weightGrams ?? null,
    is_available: v.isAvailable ?? true,
    sort_order: 0,
    grind_options: (v.grindOptions || []).map((g: string) => GRIND_MAP[g] || g),
    created_at: "",
    updated_at: "",
  }
}

function isAvailableVariant(variant: ProductVariant) {
  return variant.is_available !== false
}

function hasAvailablePayloadVariant(product: PayloadProductDoc) {
  return (product.variants || []).some((variant) => variant.isAvailable !== false)
}

function extractMediaUrl(media: PayloadMediaRef): string | null {
  if (!isPayloadMedia(media)) return null
  return getMediaUrl(media as MediaUrlRef, ["card", "full", "thumbnail"])
}

function resolveProductType(doc: { productTypeRef?: PayloadProductTypeDoc | string | number | null }): ProductType {
  const typeRef = doc.productTypeRef
  if (typeRef && typeof typeRef === "object" && typeRef.slug) {
    return typeRef.slug
  }
  return "" as ProductType
}

function getProductTypeId(doc: PayloadProductTypeDoc | undefined): string | number | undefined {
  return doc?.id
}

function buildProductTypeWhere(typeId?: string | number): Where {
  if (typeId === undefined) {
    return { id: { equals: -1 } }
  }
  return { productTypeRef: { equals: typeId } }
}

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>

async function findProductTypeBySlug(payload: PayloadClient, slug: ProductType): Promise<PayloadProductTypeDoc | null> {
  try {
    const { docs } = await payload.find({
      collection: "product-types",
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 1,
    })
    return (docs[0] as PayloadProductTypeDoc | undefined) || null
  } catch {
    return null
  }
}

async function countProductsByType(payload: PayloadClient, typeId?: string | number): Promise<number> {
  if (typeId === undefined) return 0

  const result = await payload.find({
    collection: "products",
    where: {
      and: [
        { isVisible: { equals: true } },
        buildProductTypeWhere(typeId),
      ],
    },
    limit: 1,
    depth: 0,
  })
  return result.totalDocs
}

function transformProductType(doc: PayloadProductTypeDoc): ProductTypeOption | null {
  const slug = doc.slug
  if (!slug) return null

  return {
    id: String(doc.id ?? slug),
    slug,
    name: doc.name || slug,
    icon_url: extractMediaUrl(doc.icon) || null,
    sort_order: doc.sortOrder ?? 0,
    product_count: 0,
    details_schema: normalizeProductDetailsSchema(doc.detailsSchema),
  }
}

function serializeProductDescription(description: SerializedEditorState | string | null | undefined): string {
  if (!description) return ""
  if (typeof description === "string") return description

  try {
    return convertLexicalToHTML({
      data: description,
      disableContainer: true,
    })
  } catch (error) {
    console.error("Failed to serialize product description:", error)
    return ""
  }
}

function transformAttachedFiles(files: PayloadProductDoc["attachedFiles"] | undefined | null): AttachedFile[] {
  if (!files || !Array.isArray(files)) return []
  return files
    .map((entry) => {
      const file = entry?.file
      if (!file || typeof file === "string" || typeof file === "number") return null
      return {
        name: entry.label || file.filename || "File",
        url: file.url || "",
        size: file.filesize || 0,
      }
    })
    .filter(Boolean) as AttachedFile[]
}

function resolveProductTypeName(doc: { productTypeRef?: PayloadProductTypeDoc | string | number | null }): string {
  const typeRef = doc.productTypeRef
  if (typeRef && typeof typeRef === "object") {
    return typeRef.name || typeRef.slug || ""
  }
  return ""
}

function resolveProductTypeSchema(doc: { detailsSchema?: ProductDetailsSchema; productTypeRef?: PayloadProductTypeDoc | string | number | null }): ProductDetailsSchema {
  const typeRef = doc.productTypeRef
  if (typeRef && typeof typeRef === "object") {
    return normalizeProductDetailsSchema(typeRef.detailsSchema)
  }
  return normalizeProductDetailsSchema(doc.detailsSchema)
}

function getProductRating(reviews: ProductReview[], manualRating?: number | null, manualRatingCount?: number | null) {
  if (typeof manualRating === "number" && manualRating > 0) {
    return {
      rating: Math.round(manualRating * 10) / 10,
      reviews_count: typeof manualRatingCount === "number" && manualRatingCount > 0 ? manualRatingCount : reviews.length,
    }
  }
  if (reviews.length > 0) {
    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    return { rating: Math.round(average * 10) / 10, reviews_count: reviews.length }
  }
  if (typeof manualRatingCount === "number" && manualRatingCount > 0) {
    return { rating: undefined, reviews_count: manualRatingCount }
  }
  return { rating: undefined, reviews_count: undefined }
}

async function fetchReviewsMap(): Promise<Map<string, ProductReview[]>> {
  const payload = await getPayloadClient()
  try {
    const { docs } = await payload.find({
      collection: "product-reviews",
      where: { status: { equals: "approved" } },
      limit: 20000,
      depth: 1,
      sort: "-createdAt",
    })
    const map = new Map<string, ProductReview[]>()
    for (const doc of docs as PayloadReviewDoc[]) {
      const productId = getRelationshipId(doc.product)
      if (productId === null) continue
      const review: ProductReview = {
        id: String(doc.id),
        author_name: (typeof doc.authorClient === "object" && doc.authorClient?.fullName) || doc.authorName || null,
        client_id: doc.clientId || null,
        rating: typeof doc.rating === "number" ? doc.rating : 0,
        comment: doc.comment || null,
        created_at: doc.createdAt || "",
      }
      const list = map.get(String(productId)) || []
      list.push(review)
      map.set(String(productId), list)
    }
    return map
  } catch {
    return new Map()
  }
}

function transformProduct(doc: PayloadProductDoc, reviews: ProductReview[] = []): Product {
  const productId = String(doc.id)
  const categoryIds = getCategoryIds(doc.category)
  const categoryId = categoryIds[0] || ""
  const coffee = doc.coffeeDetails || {}
  const tea = doc.teaDetails || {}

  const descriptionHtml = serializeProductDescription(doc.description)

  return {
    id: productId,
    category_id: categoryId,
    category_ids: categoryIds,
    product_type: resolveProductType(doc),
    product_type_name: resolveProductTypeName(doc),
    product_type_schema: resolveProductTypeSchema(doc),
    name: doc.name || "",
    slug: doc.slug || "",
    description: descriptionHtml || null,
    description_images: [],
    sort_order: doc.sortOrder || 0,
    is_visible: doc.isVisible ?? true,
    is_popular: doc.isPopular ?? false,
    stickers: (doc.stickers || []).map(transformTag).filter(isDefined),

    // Rating & reviews
    ...getProductRating(reviews, doc.manualRating, doc.manualRatingCount),
    reviews,

    // Coffee details (flattened from coffeeDetails group)
    roaster: coffee.roaster || null,
    roast_level: coffee.roastLevel || null,
    country: coffee.country || null,
    region: coffee.region || null,
    processing_method: coffee.processingMethod || null,
    taste_description: coffee.tasteDescription || null,
    acidity: typeof coffee.acidity === "number" ? coffee.acidity : null,
    bitterness: typeof coffee.bitterness === "number" ? coffee.bitterness : null,
    sweetness: typeof coffee.sweetness === "number" ? coffee.sweetness : null,
    body: typeof coffee.body === "number" ? coffee.body : null,
    coffee_group: coffee.brewGroup || null,
    growing_height: coffee.growingHeight || null,
    q_grader_rating: coffee.qGraderRating || null,

    // Legacy per-product methods remain in existing data but are no longer shown on product pages.
    brewing_methods: (coffee.brewingMethods || []).map((method) => ({
      method: method.method || "",
      description: method.description || "",
      image_url: extractMediaUrl(method.image) || undefined,
    })),

    // Tea brewing instructions
    brewing_instructions: (tea.brewingInstructions || []).map((i) => ({
      title: i.title || "",
      text: i.text || "",
      image_url: extractMediaUrl(i.image) || undefined,
    })),

    // Files
    attached_files: transformAttachedFiles(doc.attachedFiles),

    // Media
    images: extractImageUrls(doc.images),
    video_urls: (doc.videoUrls || []).map((v) => v.url).filter(isNonEmptyString),

    created_at: doc.createdAt || "",
    updated_at: doc.updatedAt || "",

    // Relations
    variants: (doc.variants || [])
      .map((v) => transformVariant(v, productId))
      .filter(isAvailableVariant),
  }
}

function transformCategory(doc: PayloadCategoryDoc): CatalogCategoryDoc {
  return {
    ...doc,
    image: isPayloadMedia(doc.image) ? doc.image : null,
    children: (doc.children || []).map(transformCategory),
  }
}

// ============================================================
// Public API
// ============================================================

export async function getProductTypes(): Promise<ProductTypeOption[]> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "product-types",
    where: { isVisible: { equals: true } },
    sort: "sortOrder",
    limit: 100,
    depth: 1,
  })

  const productTypeDocs = docs as PayloadProductTypeDoc[]

  const withCounts = await Promise.all(
    productTypeDocs.map(async (doc) => {
      const option = transformProductType(doc)
      if (!option) return null

      const productCount = await countProductsByType(payload, getProductTypeId(doc))
      return { ...option, product_count: productCount }
    })
  )

  return withCounts
    .filter((type): type is ProductTypeOption => type !== null)
    .filter((type) => type.product_count > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"))
}

export async function getCategories(productType?: ProductType): Promise<CatalogCategoryDoc[]> {
  const payload = await getPayloadClient()

  let where: Where = { isVisible: { equals: true } }
  let productTypeId: string | number | undefined
  if (productType) {
    const typeDoc = await findProductTypeBySlug(payload, productType)
    productTypeId = getProductTypeId(typeDoc || undefined)
    where = {
      and: [
        { isVisible: { equals: true } },
        buildProductTypeWhere(productTypeId),
      ],
    }
  }

  const { docs } = await payload.find({
    collection: "categories",
    where,
    sort: "sortOrder",
    limit: 200,
    depth: 1,
  })

  const all = docs as PayloadCategoryDoc[]
  const visibleProductsResult = await payload.find({
    collection: "products",
    where: productTypeId === undefined
      ? { isVisible: { equals: true } }
      : {
          and: [
            { isVisible: { equals: true } },
            buildProductTypeWhere(productTypeId),
          ],
        },
    limit: 1000,
    depth: 0,
  })

  const categoryIdsWithProducts = new Set(
    (visibleProductsResult.docs as PayloadProductDoc[])
      .filter(hasAvailablePayloadVariant)
      .map((product) => {
        const categoryId = typeof product.category === "object" && product.category !== null
          ? product.category.id
          : product.category
        return categoryId === undefined || categoryId === null ? null : String(categoryId)
      })
      .filter((id): id is string => Boolean(id))
  )

  const roots = all.filter((c) => !c.parent)
  const childMap = new Map<number, PayloadCategoryDoc[]>()

  all.forEach((c) => {
    if (c.parent) {
      const parentId = typeof c.parent === "object" ? c.parent.id : c.parent
      if (parentId === undefined) return
      const existing = childMap.get(parentId) || []
      existing.push(c)
      childMap.set(parentId, existing)
    }
  })

  const hasProducts = (category: PayloadCategoryDoc): boolean => {
    if (categoryIdsWithProducts.has(String(category.id))) return true
    return (childMap.get(category.id) || []).some(hasProducts)
  }

  const visibleRoots = roots
    .map((root) => ({
      ...root,
      children: (childMap.get(root.id) || []).filter(hasProducts),
    }))
    .filter(hasProducts)

  return visibleRoots.map(transformCategory)
}

export async function getProductsByCategory(categoryId: number | string): Promise<Product[]> {
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: "products",
    where: {
      category: { equals: categoryId },
      isVisible: { equals: true },
    },
    sort: "sortOrder",
    limit: 100,
    depth: 2,
  })

  const reviewsMap = await fetchReviewsMap()
  return (docs as PayloadProductDoc[])
    .map((doc) => transformProduct(doc, reviewsMap.get(String(doc.id)) || []))
    .filter((product) => product.variants?.some(isAvailableVariant))
}

export async function getProductById(id: number | string): Promise<Product | null> {
  const payload = await getPayloadClient()

  try {
    const doc = await payload.findByID({
      collection: "products",
      id: id,
      depth: 2,
    })
    const reviewsMap = await fetchReviewsMap()
    const product = transformProduct(doc as PayloadProductDoc, reviewsMap.get(String(doc.id)) || [])
    if (!product.is_visible || !product.variants?.some(isAvailableVariant)) return null
    return product
  } catch {
    return null
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: "products",
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })

  if (!docs[0]) return null
  const reviewsMap = await fetchReviewsMap()
  const product = transformProduct(docs[0] as PayloadProductDoc, reviewsMap.get(String(docs[0].id)) || [])
  if (!product.is_visible || !product.variants?.some(isAvailableVariant)) return null
  return product
}

export async function searchProducts(query: string): Promise<Product[]> {
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: "products",
    where: {
      name: { contains: query },
      isVisible: { equals: true },
    },
    sort: "sortOrder",
    limit: 20,
    depth: 2,
  })

  const reviewsMap = await fetchReviewsMap()
  return (docs as PayloadProductDoc[])
    .map((doc) => transformProduct(doc, reviewsMap.get(String(doc.id)) || []))
    .filter((product) => product.variants?.some(isAvailableVariant))
}

export async function getShopProducts(): Promise<Product[]> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "products",
    where: { isVisible: { equals: true } },
    sort: "sortOrder",
    limit: 1000,
    depth: 2,
  })

  const reviewsMap = await fetchReviewsMap()
  return (docs as PayloadProductDoc[])
    .map((doc) => transformProduct(doc, reviewsMap.get(String(doc.id)) || []))
    .filter((product) => product.variants?.some(isAvailableVariant))
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []

  const payload = await getPayloadClient()
  const numericIds = ids.map(Number).filter((id) => Number.isInteger(id))
  if (numericIds.length === 0) return []

  const { docs } = await payload.find({
    collection: "products",
    where: { id: { in: numericIds } },
    limit: 100,
    depth: 2,
  })

  const reviewsMap = await fetchReviewsMap()
  const order = new Map(numericIds.map((id, index) => [id, index]))
  return (docs as PayloadProductDoc[])
    .map((doc) => transformProduct(doc, reviewsMap.get(String(doc.id)) || []))
    .filter((product) => product.is_visible && product.variants?.some(isAvailableVariant))
    .sort((a, b) => {
      const ai = order.get(Number(a.id)) ?? Number.MAX_SAFE_INTEGER
      const bi = order.get(Number(b.id)) ?? Number.MAX_SAFE_INTEGER
      return ai - bi
    })
}

/**
 * Loads product metadata for the authenticated customer's purchase history.
 * Includes hidden and unavailable products so an old order keeps contributing
 * to the preference profile after the assortment changes.
 */
export async function getProductsForPreferences(ids: string[], names: string[]): Promise<Product[]> {
  if (!await getCurrentUserId()) return []

  const numericIds = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  const productNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  if (!numericIds.length && !productNames.length) return []

  const conditions: Where[] = []
  if (numericIds.length) conditions.push({ id: { in: numericIds } })
  if (productNames.length) conditions.push({ name: { in: productNames } })

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "products",
    where: conditions.length === 1 ? conditions[0] : { or: conditions },
    limit: Math.min(1000, Math.max(numericIds.length + productNames.length, 1)),
    depth: 2,
  })

  return (docs as PayloadProductDoc[]).map((doc) => transformProduct(doc))
}

// ============================================================
// Client discount
// ============================================================

export async function getClientDiscount(): Promise<number> {
  const config = await getClientDiscountConfig()
  return config.discountPercent
}

export async function getClientDiscountConfig(): Promise<ClientDiscountConfig> {
  const userId = await getCurrentUserId()
  if (!userId) return EMPTY_CLIENT_DISCOUNT_CONFIG

  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: "clients",
      where: { supabaseId: { equals: userId } },
      limit: 1,
      depth: 1,
    })

    const client = docs[0] as PayloadClientDiscountDoc | undefined
    if (!client) return EMPTY_CLIENT_DISCOUNT_CONFIG

    const categoryDiscounts = (client.categoryDiscounts || [])
      .map((rule): CategoryDiscountRule | null => {
        const categoryId = getRelationshipId(rule.category)
        if (categoryId === null) return null

        const categoryName = typeof rule.category === "object" && rule.category !== null
          ? rule.category.name
          : undefined

        return {
          categoryId: String(categoryId),
          categoryName,
          discountPercent: normalizeDiscountPercent(rule.discountPercent),
        }
      })
      .filter((rule): rule is CategoryDiscountRule => rule !== null)

    const productDiscounts = (client.productDiscounts || []).flatMap((rule) => {
      const discountPercent = normalizeDiscountPercent(rule.discountPercent)
      return (rule.products || [])
        .map((product): ProductDiscountRule | null => {
          const productId = getRelationshipId(product)
          if (productId === null) return null

          return {
            productId: String(productId),
            productName: typeof product === "object" && product !== null ? product.name : undefined,
            discountPercent,
          }
        })
        .filter((entry): entry is ProductDiscountRule => entry !== null)
    })

    return {
      discountPercent: normalizeDiscountPercent(client.discountPercent),
      categoryDiscounts: normalizeCategoryDiscounts(categoryDiscounts),
      productDiscounts: normalizeProductDiscounts(productDiscounts),
    }
  } catch {
    return EMPTY_CLIENT_DISCOUNT_CONFIG
  }
}

// ============================================================
// Favorites (Payload-based)
// ============================================================

export async function getFavoriteProductIds(sessionScope?: CustomerSessionScope): Promise<string[]> {
  const clientId = await getCurrentUserId(sessionScope)
  if (!clientId) return []

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "favorites",
    where: { clientId: { equals: clientId } },
    limit: 500,
    depth: 0,
  })

  return (docs as PayloadFavoriteDoc[]).map((d) => String(typeof d.product === "object" && d.product !== null ? d.product.id : d.product))
}

export async function getFavoriteProducts(sessionScope?: CustomerSessionScope): Promise<Product[]> {
  const clientId = await getCurrentUserId(sessionScope)
  if (!clientId) return []

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: "favorites",
    where: { clientId: { equals: clientId } },
    limit: 200,
    depth: 2,
  })

  const reviewsMap = await fetchReviewsMap()
  return (docs as PayloadFavoriteDoc[])
    .map((d) => {
      const raw = typeof d.product === "object" ? d.product : null
      if (!raw) return null
      const productId = getRelationshipId(d.product)
      return transformProduct(raw as PayloadProductDoc, productId === null ? [] : reviewsMap.get(String(productId)) || [])
    })
    .filter((product): product is Product => Boolean(product?.is_visible && product.variants?.some(isAvailableVariant)))
}

export async function toggleFavorite(productId: string, sessionScope?: CustomerSessionScope): Promise<{ isFavorite: boolean }> {
  const clientId = await getCurrentUserId(sessionScope)
  if (!clientId) return { isFavorite: false }

  const payload = await getPayloadClient()
  // Check if already favorited
  const { docs } = await payload.find({
    collection: "favorites",
    where: {
      and: [
        { clientId: { equals: clientId } },
        { product: { equals: parseInt(productId, 10) } },
      ],
    },
    limit: 1,
  })

  if (docs.length > 0) {
    // Remove favorite
    await payload.delete({ collection: "favorites", id: docs[0].id })
    return { isFavorite: false }
  } else {
    // Add favorite
    await payload.create({
      collection: "favorites",
      data: { clientId, product: parseInt(productId, 10) },
    })
    return { isFavorite: true }
  }
}

export async function getTags() {
  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: "tags",
      limit: 100,
      sort: "name",
    })
    return (docs as PayloadTagDoc[]).map((tag) => ({
      id: String(tag.id),
      name: tag.name || "",
      slug: tag.slug || "",
      color: normalizeTagColor(tag.color),
    }))
  } catch {
    return []
  }
}

export interface MyReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  status?: "pending" | "approved" | "rejected" | string | null
  product: {
    id: string
    name: string
    slug: string
    image: string | null
  }
}

export async function getMyReviews(): Promise<MyReview[]> {
  const clientId = await getCurrentUserId()
  if (!clientId) return []

  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: "product-reviews",
      where: { clientId: { equals: clientId } },
      limit: 500,
      sort: "-createdAt",
      depth: 1,
    })

    return (docs as PayloadReviewDoc[])
      .map((doc): MyReview | null => {
        const rawProduct = typeof doc.product === "object" ? doc.product : null
        if (!rawProduct) return null
        const productId = getRelationshipId(doc.product)
        if (productId === null) return null

        return {
          id: String(doc.id),
          rating: typeof doc.rating === "number" ? doc.rating : 0,
          comment: doc.comment || null,
          created_at: doc.createdAt || "",
          status: doc.status || "pending",
          product: {
            id: String(productId),
            name: rawProduct.name || "",
            slug: rawProduct.slug || String(productId),
            image: extractImageUrls(rawProduct.images)[0] || null,
          },
        }
      })
      .filter((entry): entry is MyReview => entry !== null)
  } catch {
    return []
  }
}
