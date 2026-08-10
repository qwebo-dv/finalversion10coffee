import type { ProductVariant } from "@/types"

export const GRIND_OPTION_LABELS: Record<string, string> = {
  beans: "В зёрнах",
  ground: "Молотый",
}

export function getVariantGrindOption(variant: ProductVariant | null | undefined): string | null {
  if (!variant) return null
  const explicit = variant.grind_options[0]
  if (explicit) return explicit
  if (/молот/i.test(variant.name)) return "ground"
  if (/зерн/i.test(variant.name)) return "beans"
  return null
}

export function getVariantWeights(variants: ProductVariant[]): number[] {
  return [...new Set(
    variants
      .map((variant) => variant.weight_grams)
      .filter((weight): weight is number => typeof weight === "number" && weight > 0)
  )].sort((a, b) => b - a)
}

export function getGrindOptions(variants: ProductVariant[], weight?: number | null): string[] {
  return [...new Set(
    variants
      .filter((variant) => !weight || variant.weight_grams === weight)
      .map(getVariantGrindOption)
      .filter((option): option is string => Boolean(option))
  )]
}

export function findVariantForSelection(
  variants: ProductVariant[],
  weight: number | null,
  grindOption: string | null
): ProductVariant | null {
  return variants.find((variant) => (
    (!weight || variant.weight_grams === weight)
    && (!grindOption || getVariantGrindOption(variant) === grindOption)
  )) || variants.find((variant) => !weight || variant.weight_grams === weight) || null
}
