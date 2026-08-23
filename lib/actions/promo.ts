"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { createClient } from "@/lib/supabase/server"

export type PromoValidationResult =
  | {
      valid: true
      promoCodeId: string
      discountType: "percentage" | "fixed_amount"
      discountValue: number
      calculatedDiscount: number
      applicableProductIds: string[]
      applicableProductNames: string[]
    }
  | {
      valid: false
      error: string
    }

interface PromoCartLine {
  productId: string
  subtotal: number
}

export async function validatePromoCode(
  code: string,
  subtotal: number,
  cartLines: PromoCartLine[] = []
): Promise<PromoValidationResult> {
  const payload = await getPayload({ config: configPromise })
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { valid: false, error: "Необходима авторизация" }

  const { docs } = await payload.find({
    collection: "promo-codes",
    where: { code: { equals: code.trim().toUpperCase() } },
    limit: 1,
  })

  if (!docs.length) return { valid: false, error: "Промокод не найден" }

  const promo = docs[0]

  const clientResult = await payload.find({
    collection: "clients",
    where: { supabaseId: { equals: user.id } },
    limit: 1,
    depth: 0,
  })
  const client = clientResult.docs[0] as { customerType?: "individual" | "business" | null } | undefined
  const customerType = client?.customerType === "individual" ? "individual" : "business"
  const audience = (promo.audience as "all" | "individual" | "business" | undefined) || "business"
  if (audience !== "all" && audience !== customerType) {
    return { valid: false, error: audience === "individual" ? "Промокод доступен только физическим лицам" : "Промокод доступен только юридическим лицам" }
  }

  if (!promo.isActive) return { valid: false, error: "Промокод неактивен" }

  if (promo.startsAt && new Date(promo.startsAt as string) > new Date()) {
    return { valid: false, error: "Промокод ещё не активен" }
  }

  if (promo.expiresAt && new Date(promo.expiresAt as string) < new Date()) {
    return { valid: false, error: "Промокод истёк" }
  }

  if (
    promo.maxUses !== null &&
    promo.maxUses !== undefined &&
    ((promo.currentUses as number) || 0) >= (promo.maxUses as number)
  ) {
    return { valid: false, error: "Промокод исчерпан" }
  }

  if (promo.restrictedToEmail && String(user.email || "").toLowerCase() !== String(promo.restrictedToEmail).toLowerCase()) {
    return {
      valid: false,
      error: "Промокод недоступен для вашего аккаунта",
    }
  }

  if (
    promo.minOrderAmount &&
    subtotal < (promo.minOrderAmount as number)
  ) {
    return {
      valid: false,
      error: `Минимальная сумма заказа: ${(promo.minOrderAmount as number).toLocaleString("ru-RU")} ₽`,
    }
  }

  if (promo.isSingleUse) {
    const { data: usages } = await supabase
      .from("promo_code_usages")
      .select("id")
      .eq("promo_code_id", String(promo.id))
      .eq("client_id", user.id)
      .limit(1)

    if (usages && usages.length > 0) {
      return { valid: false, error: "Вы уже использовали этот промокод" }
    }
  }

  const discountType = promo.discountType as "percentage" | "fixed_amount"
  const discountValue = promo.discountValue as number
  const applicableProductIds = Array.isArray(promo.applicableProducts)
    ? (promo.applicableProducts as ({ id?: string | number } | string | number)[])
      .map((value) => String(typeof value === "object" ? value.id ?? "" : value))
      .filter(Boolean)
    : []
  const applicableProductNames = Array.isArray(promo.applicableProducts)
    ? (promo.applicableProducts as ({ name?: string } | string | number)[])
      .map((value) => typeof value === "object" ? String(value.name || "") : "")
      .filter(Boolean)
    : []
  const eligibleSubtotal = applicableProductIds.length === 0
    ? subtotal
    : cartLines
      .filter((line) => applicableProductIds.includes(line.productId))
      .reduce((sum, line) => sum + line.subtotal, 0)

  if (applicableProductIds.length > 0 && eligibleSubtotal <= 0) {
    return { valid: false, error: "В корзине нет товаров, участвующих в промокоде" }
  }
  let calculatedDiscount = 0

  if (discountType === "percentage") {
    calculatedDiscount = Math.round((eligibleSubtotal * discountValue) / 100)
  } else {
    calculatedDiscount = Math.min(discountValue, eligibleSubtotal)
  }

  return {
    valid: true,
    promoCodeId: String(promo.id),
    discountType,
    discountValue,
    calculatedDiscount,
    applicableProductIds,
    applicableProductNames,
  }
}
