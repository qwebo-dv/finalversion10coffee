import { getPayload, type Payload } from "payload"
import configPromise from "@payload-config"

export type DeliveryPackageSize = "S" | "M" | "L"

export interface DeliveryPackageConfig {
  size: DeliveryPackageSize
  lengthCm: number
  widthCm: number
  heightCm: number
  maxWeightGrams: number
  costRubles: number
}

export interface DeliveryPackagingSettings {
  enabled: boolean
  fallbackPackageSize: DeliveryPackageSize
  packages: DeliveryPackageConfig[]
}

export interface ShippingPackagingLine {
  quantity: number
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  weightGrams?: number | null
}

export function shippingLinesFromCartItems(items: Array<{
  quantity: number
  variant?: {
    weight_grams?: number | null
    shipping_length_cm?: number | null
    shipping_width_cm?: number | null
    shipping_height_cm?: number | null
    shipping_weight_grams?: number | null
  }
}>): ShippingPackagingLine[] {
  return items.map((item) => ({
    quantity: item.quantity,
    lengthCm: item.variant?.shipping_length_cm,
    widthCm: item.variant?.shipping_width_cm,
    heightCm: item.variant?.shipping_height_cm,
    weightGrams: item.variant?.shipping_weight_grams ?? item.variant?.weight_grams,
  }))
}

export interface CalculatedDeliveryPackage {
  size: DeliveryPackageSize
  length: number
  width: number
  height: number
  weight: number
  cost: number
}

export interface DeliveryPackagingPlan {
  packages: CalculatedDeliveryPackage[]
  packagingCost: number
}

const DEFAULT_SETTINGS: DeliveryPackagingSettings = {
  enabled: true,
  fallbackPackageSize: "S",
  packages: [
    { size: "S", lengthCm: 25, widthCm: 10, heightCm: 15, maxWeightGrams: 2000, costRubles: 100 },
    { size: "M", lengthCm: 35, widthCm: 15, heightCm: 25, maxWeightGrams: 5000, costRubles: 200 },
    { size: "L", lengthCm: 45, widthCm: 30, heightCm: 20, maxWeightGrams: 12000, costRubles: 400 },
  ],
}

type PackageSettingsGroup = {
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  maxWeightGrams?: number | null
  costRubles?: number | null
}

type DeliverySettingsDocument = {
  cdekPackagingEnabled?: boolean | null
  fallbackPackageSize?: DeliveryPackageSize | null
  packageS?: PackageSettingsGroup | null
  packageM?: PackageSettingsGroup | null
  packageL?: PackageSettingsGroup | null
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizePackage(
  size: DeliveryPackageSize,
  value: PackageSettingsGroup | null | undefined,
  fallback: DeliveryPackageConfig,
): DeliveryPackageConfig {
  return {
    size,
    lengthCm: positiveNumber(value?.lengthCm, fallback.lengthCm),
    widthCm: positiveNumber(value?.widthCm, fallback.widthCm),
    heightCm: positiveNumber(value?.heightCm, fallback.heightCm),
    maxWeightGrams: positiveNumber(value?.maxWeightGrams, fallback.maxWeightGrams),
    costRubles: nonNegativeNumber(value?.costRubles, fallback.costRubles),
  }
}

export async function getDeliveryPackagingSettings(payload?: Payload): Promise<DeliveryPackagingSettings> {
  const client = payload || await getPayload({ config: configPromise })
  try {
    const document = await client.findGlobal({ slug: "delivery-settings", depth: 0 }) as DeliverySettingsDocument
    return {
      enabled: document.cdekPackagingEnabled !== false,
      fallbackPackageSize: document.fallbackPackageSize === "M" || document.fallbackPackageSize === "L"
        ? document.fallbackPackageSize
        : "S",
      packages: [
        normalizePackage("S", document.packageS, DEFAULT_SETTINGS.packages[0]),
        normalizePackage("M", document.packageM, DEFAULT_SETTINGS.packages[1]),
        normalizePackage("L", document.packageL, DEFAULT_SETTINGS.packages[2]),
      ],
    }
  } catch (error) {
    console.error("[delivery-packaging] Не удалось загрузить настройки, используются безопасные значения по умолчанию", error)
    return DEFAULT_SETTINGS
  }
}

function sortedDimensions(length: number, width: number, height: number): [number, number, number] {
  return [length, width, height].sort((left, right) => left - right) as [number, number, number]
}

type ShippingUnit = {
  dimensions: [number, number, number]
  volume: number
  weight: number
  exclusive: boolean
}

type PackingBin = {
  usedWeight: number
  exclusive: boolean
  placements: Placement[]
}

type Placement = {
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
}

function buildUnits(lines: ShippingPackagingLine[], settings: DeliveryPackagingSettings): ShippingUnit[] {
  const fallback = settings.packages.find((item) => item.size === settings.fallbackPackageSize) || settings.packages[0]
  const result: ShippingUnit[] = []

  for (const line of lines) {
    const quantity = Math.max(0, Math.min(100, Math.floor(Number(line.quantity) || 0)))
    const hasDimensions = [line.lengthCm, line.widthCm, line.heightCm]
      .every((value) => Number.isFinite(Number(value)) && Number(value) > 0)
    const length = hasDimensions ? Number(line.lengthCm) : fallback.lengthCm
    const width = hasDimensions ? Number(line.widthCm) : fallback.widthCm
    const height = hasDimensions ? Number(line.heightCm) : fallback.heightCm
    const weight = positiveNumber(line.weightGrams, Math.min(1000, fallback.maxWeightGrams))
    const dimensions = sortedDimensions(length, width, height)

    for (let index = 0; index < quantity; index += 1) {
      result.push({
        dimensions,
        volume: length * width * height,
        weight,
        // Missing dimensions must never silently understate the packaging cost.
        exclusive: !hasDimensions,
      })
    }
  }

  return result.sort((left, right) =>
    Number(right.exclusive) - Number(left.exclusive)
    || right.volume - left.volume
    || right.weight - left.weight,
  )
}

function unitFitsPackage(unit: ShippingUnit, packageConfig: DeliveryPackageConfig): boolean {
  const packageDimensions = sortedDimensions(packageConfig.lengthCm, packageConfig.widthCm, packageConfig.heightCm)
  return unit.dimensions.every((dimension, index) => dimension <= packageDimensions[index])
    && unit.weight <= packageConfig.maxWeightGrams
}

function rotations(dimensions: [number, number, number]): [number, number, number][] {
  const [a, b, c] = dimensions
  const values: [number, number, number][] = [
    [a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a],
  ]
  return values.filter((value, index) =>
    values.findIndex((candidate) => candidate.every((dimension, axis) => dimension === value[axis])) === index,
  )
}

function overlaps(left: Placement, right: Placement): boolean {
  return left.x < right.x + right.length && left.x + left.length > right.x
    && left.y < right.y + right.width && left.y + left.width > right.y
    && left.z < right.z + right.height && left.z + left.height > right.z
}

function tryPlaceUnit(
  bin: PackingBin,
  unit: ShippingUnit,
  packageConfig: DeliveryPackageConfig,
): Placement | null {
  if (bin.exclusive || bin.usedWeight + unit.weight > packageConfig.maxWeightGrams) return null

  const points = [
    { x: 0, y: 0, z: 0 },
    ...bin.placements.flatMap((placed) => [
      { x: placed.x + placed.length, y: placed.y, z: placed.z },
      { x: placed.x, y: placed.y + placed.width, z: placed.z },
      { x: placed.x, y: placed.y, z: placed.z + placed.height },
    ]),
  ].filter((point, index, all) =>
    all.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y && candidate.z === point.z) === index,
  ).sort((left, right) => left.z - right.z || left.y - right.y || left.x - right.x)

  for (const [length, width, height] of rotations(unit.dimensions)) {
    for (const point of points) {
      const placement: Placement = { ...point, length, width, height }
      if (placement.x + length > packageConfig.lengthCm
        || placement.y + width > packageConfig.widthCm
        || placement.z + height > packageConfig.heightCm) continue
      if (bin.placements.some((placed) => overlaps(placement, placed))) continue
      return placement
    }
  }
  return null
}

function packUsingSingleSize(units: ShippingUnit[], packageConfig: DeliveryPackageConfig): PackingBin[] | null {
  if (units.some((unit) => !unitFitsPackage(unit, packageConfig))) return null

  const bins: PackingBin[] = []
  for (const unit of units) {
    let placed = false
    if (!unit.exclusive) {
      for (const bin of bins) {
        const placement = tryPlaceUnit(bin, unit, packageConfig)
        if (!placement) continue
        bin.placements.push(placement)
        bin.usedWeight += unit.weight
        placed = true
        break
      }
    }
    if (!placed) {
      const bin: PackingBin = { usedWeight: 0, exclusive: unit.exclusive, placements: [] }
      const placement = tryPlaceUnit(
        { ...bin, exclusive: false },
        unit,
        packageConfig,
      )
      if (!placement) return null
      bin.placements.push(placement)
      bin.usedWeight = unit.weight
      bins.push(bin)
    }
  }
  return bins
}

export function calculateDeliveryPackaging(
  lines: ShippingPackagingLine[],
  settings: DeliveryPackagingSettings,
): DeliveryPackagingPlan {
  const units = buildUnits(lines, settings)
  if (units.length === 0) return { packages: [], packagingCost: 0 }

  const candidates = settings.packages.flatMap((packageConfig) => {
    const bins = packUsingSingleSize(units, packageConfig)
    if (!bins) return []
    const packages = bins.map<CalculatedDeliveryPackage>((bin) => ({
      size: packageConfig.size,
      length: packageConfig.lengthCm,
      width: packageConfig.widthCm,
      height: packageConfig.heightCm,
      weight: Math.max(1, Math.ceil(bin.usedWeight)),
      cost: settings.enabled ? packageConfig.costRubles : 0,
    }))
    return [{
      packages,
      packagingCost: packages.reduce((sum, item) => sum + item.cost, 0),
      packageVolume: packageConfig.lengthCm * packageConfig.widthCm * packageConfig.heightCm,
    }]
  })

  const selected = candidates.sort((left, right) =>
    left.packages.length - right.packages.length
    || left.packagingCost - right.packagingCost
    || left.packageVolume - right.packageVolume,
  )[0]

  if (!selected) {
    throw new Error("Габариты или вес одной единицы товара превышают максимальную упаковку L")
  }

  return { packages: selected.packages, packagingCost: selected.packagingCost }
}
