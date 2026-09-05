"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { requirePayloadAdmin } from "@/lib/auth/payload-admin"
import { getMoyskladConfig } from "@/lib/moysklad/config"
import { extractMoyskladId, moyskladGetList } from "@/lib/moysklad/client"
import { importMoyskladCatalog } from "@/lib/moysklad/import-catalog"
import { setupMoyskladDeliveryService } from "@/lib/moysklad/service-setup"
import { syncMoyskladOrderStatuses } from "@/lib/moysklad/status-sync"
import { fetchMoyskladAssortment, fetchMoyskladProductFolders, getPrimarySalePrice } from "@/lib/moysklad/products"
import type { MoyskladAssortment, MoyskladEntity } from "@/lib/moysklad/types"

interface PayloadVariantForSync {
  id?: string | null
  name?: string
  sku?: string | null
  moyskladId?: string | null
  moyskladType?: "product" | "variant" | "service" | null
  price?: number
  weightGrams?: number | null
  isAvailable?: boolean
  grindOptions?: ("beans" | "ground")[] | null
}

interface PayloadProductForSync {
  id: string | number
  name?: string
  moyskladId?: string | null
  variants?: PayloadVariantForSync[]
}

async function getPayloadClient() {
  return getPayload({ config: configPromise })
}

async function fetchAllAssortment(limit = 100, maxItems = 1000) {
  const rows: MoyskladAssortment[] = []
  for (let offset = 0; offset < maxItems; offset += limit) {
    const batch = await fetchMoyskladAssortment(limit, offset)
    rows.push(...batch.rows)
    if (batch.rows.length < limit || rows.length >= batch.meta.size) break
  }
  return rows
}

export async function testMoyskladConnection() {
  await requirePayloadAdmin("integrations")
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false, error: "MOYSKLAD_ENABLED не включен" }
  }

  try {
    const organizations = await moyskladGetList<MoyskladEntity>("entity/organization", { limit: 1 })
    const stores = await moyskladGetList<MoyskladEntity>("entity/store", { limit: 1 })
    return {
      ok: true,
      organizations: organizations.meta.size,
      stores: stores.meta.size,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось подключиться к МойСклад",
    }
  }
}

export async function previewMoyskladCatalog() {
  await requirePayloadAdmin("integrations")
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false, error: "MOYSKLAD_ENABLED не включен" }
  }

  try {
    const [folders, assortment] = await Promise.all([
      fetchMoyskladProductFolders(20),
      fetchMoyskladAssortment(20),
    ])

    return {
      ok: true,
      folders: folders.rows.map((folder) => ({
        id: folder.id,
        name: folder.name,
        pathName: folder.pathName,
      })),
      assortment: assortment.rows.map((item) => ({
        id: item.id,
        type: item.meta?.type,
        name: item.name,
        article: item.article,
        code: item.code,
        folder: item.productFolder?.name,
      })),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось получить каталог МойСклад",
    }
  }
}

export async function syncMappedMoyskladPrices() {
  await requirePayloadAdmin("integrations")
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false, error: "MOYSKLAD_ENABLED не включен" }
  }

  try {
    const payload = await getPayloadClient()
    const [assortment, productsResult] = await Promise.all([
      fetchAllAssortment(),
      payload.find({
        collection: "products",
        depth: 0,
        limit: 1000,
      }),
    ])

    const products = productsResult.docs as PayloadProductForSync[]
    const byMoyskladId = new Map<string, {
      product: PayloadProductForSync
      variantIndex: number
    }>()

    for (const product of products) {
      for (const [variantIndex, variant] of (product.variants || []).entries()) {
        if (variant.moyskladId) {
          byMoyskladId.set(variant.moyskladId, { product, variantIndex })
        }
      }
    }

    const changedProducts = new Map<string | number, PayloadProductForSync>()
    let matched = 0
    let updatedVariants = 0
    const unmatched: { id: string; name?: string }[] = []

    for (const item of assortment) {
      const moyskladId = item.id || extractMoyskladId(item)
      if (!moyskladId) continue

      const match = byMoyskladId.get(moyskladId)
      if (!match) {
        unmatched.push({ id: moyskladId, name: item.name })
        continue
      }

      matched += 1
      const variants = [...(match.product.variants || [])]
      const current = variants[match.variantIndex]
      const next = { ...current }
      const price = getPrimarySalePrice(item)

      if (price > 0 && price !== current.price) {
        next.price = price
      }

      if (typeof item.stock === "number") {
        next.isAvailable = item.stock > 0
      }

      if (next.price !== current.price || next.isAvailable !== current.isAvailable) {
        variants[match.variantIndex] = next
        changedProducts.set(match.product.id, {
          ...match.product,
          variants,
        })
        updatedVariants += 1
      }
    }

    for (const product of changedProducts.values()) {
      await payload.update({
        collection: "products",
        id: product.id,
        data: {
          variants: product.variants,
        },
      })
    }

    return {
      ok: true,
      matched,
      updatedVariants,
      updatedProducts: changedProducts.size,
      unmatched: unmatched.slice(0, 50),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось синхронизировать цены МойСклад",
    }
  }
}

export async function runMoyskladCatalogImport() {
  await requirePayloadAdmin("integrations")
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false, error: "MOYSKLAD_ENABLED не включен" }
  }

  try {
    const payload = await getPayloadClient()
    return await importMoyskladCatalog(payload)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось импортировать каталог МойСклад",
    }
  }
}

export async function runMoyskladOrderStatusSync() {
  await requirePayloadAdmin("integrations")
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false, error: "MOYSKLAD_ENABLED не включен" }
  }

  try {
    const payload = await getPayloadClient()
    return await syncMoyskladOrderStatuses(payload)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось синхронизировать статусы МойСклад",
    }
  }
}

export async function runMoyskladDeliveryServiceSetup() {
  await requirePayloadAdmin("integrations")
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false, error: "MOYSKLAD_ENABLED не включен" }
  }

  try {
    return await setupMoyskladDeliveryService()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось настроить служебную доставку МойСклад",
    }
  }
}
