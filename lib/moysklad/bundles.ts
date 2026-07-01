import { moyskladGetList, moyskladMeta, moyskladRequest } from "./client"

export interface MoyskladSalePriceForBundle {
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
}

export interface MoyskladBundle {
  id?: string
  name?: string
  externalCode?: string
  salePrices?: MoyskladSalePriceForBundle[] | null
}

interface MoyskladProductFolderRef {
  meta?: {
    href?: string
    type?: string
    mediaType?: string
  }
}

export interface EnsureMoyskladBundleForVariantParams {
  productMoyskladId: string
  variantMoyskladId: string
  variantName: string
  variantCode?: string | null
  variantArticle?: string | null
  salePrices?: MoyskladSalePriceForBundle[] | null
  productFolder?: MoyskladProductFolderRef | null
  weightGrams: number
  priceRub?: number | null
}

function rubToKopecks(value: number) {
  return Math.round((Number(value) || 0) * 100)
}

export function buildMoyskladBundleExternalCode(variantMoyskladId: string) {
  return `10coffee-bundle-${variantMoyskladId}`
}

function buildMoyskladBundleCode(variantMoyskladId: string, variantCode?: string | null) {
  const normalizedCode = (variantCode || "").trim()
  if (normalizedCode) return `KIT-${normalizedCode}`.slice(0, 255)
  return `KIT-${variantMoyskladId.slice(0, 8)}`
}

function getSalePricesForBundle(params: EnsureMoyskladBundleForVariantParams) {
  const firstPrice = params.salePrices?.[0]
  const price = params.priceRub != null ? rubToKopecks(params.priceRub) : firstPrice?.value

  if (!firstPrice && price == null) return undefined
  if (!firstPrice) return [{ value: price }]

  return [{
    ...firstPrice,
    value: price ?? firstPrice.value,
  }]
}

async function findMoyskladBundleByExternalCode(externalCode: string) {
  const result = await moyskladGetList<MoyskladBundle>("entity/bundle", {
    filter: `externalCode=${externalCode}`,
    limit: 1,
  }).catch(() => null)

  return result?.rows?.[0] || null
}

export async function findMoyskladBundleByVariantId(variantMoyskladId: string) {
  return findMoyskladBundleByExternalCode(buildMoyskladBundleExternalCode(variantMoyskladId))
}

export async function ensureMoyskladBundleForVariant(params: EnsureMoyskladBundleForVariantParams) {
  const quantityKg = Number((params.weightGrams / 1000).toFixed(6))
  if (quantityKg <= 0) {
    throw new Error(`Не удалось определить вес комплекта ${params.variantName}`)
  }

  const externalCode = buildMoyskladBundleExternalCode(params.variantMoyskladId)
  const existing = await findMoyskladBundleByExternalCode(externalCode)
  const body = {
    name: params.variantName,
    code: buildMoyskladBundleCode(params.variantMoyskladId, params.variantCode),
    article: params.variantArticle || params.variantCode || undefined,
    externalCode,
    productFolder: params.productFolder || undefined,
    uom: {
      meta: moyskladMeta("uom", "19f1edc0-fc42-4001-94cb-c9ec9c62ec10"),
    },
    components: [
      {
        assortment: {
          meta: moyskladMeta("product", params.productMoyskladId),
        },
        quantity: quantityKg,
      },
    ],
    ...(existing?.id ? {} : { salePrices: getSalePricesForBundle(params) }),
  }

  if (existing?.id) {
    return moyskladRequest<MoyskladBundle>(`entity/bundle/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  return moyskladRequest<MoyskladBundle>("entity/bundle", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
