"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { getClientDiscountConfig, getShopProducts } from "@/lib/actions/products"
import { calculateClientDiscount, type ClientDiscountLine } from "@/lib/discounts"
import { signUp } from "@/lib/actions/auth"
import { buildMoyskladStockLossLines, syncOrderToMoysklad } from "@/lib/moysklad/sync"
import { createYooKassaPayment } from "@/lib/payments/yookassa"
import { buildYooKassaReceiptItems } from "@/lib/payments/yookassa-receipt"
import { createOrderPaymentToken } from "@/lib/payments/order-payment-token"
import { isValidRussianPhone, normalizeRussianPhone } from "@/lib/utils/phone"
import { calculateTariff } from "@/lib/cdek"
import { createClient } from "@/lib/supabase/server"
import type { CartItem, DeliveryMethod, Product } from "@/types"

export interface ShopOrderInput {
  items: {
    id: string
    productId: string
    variantId: string
    quantity: number
    grindOption?: string
  }[]
  fullName: string
  email: string
  phone: string
  address?: string
  deliveryMethod: DeliveryMethod
  comment?: string
  promoCode?: string
  deliveryCost?: number
  cdekCityCode?: number
  cdekDeliveryType?: "pickup" | "courier"
  createAccount?: boolean
  acceptTerms?: boolean
}

export interface ShopPromoPreviewInput {
  items: ShopOrderInput["items"]
  promoCode: string
  email?: string
}

export interface ShopPromoPreviewResult {
  success?: boolean
  error?: string
  code?: string
  discountAmount?: number
  discountLabel?: string
  eligibleSubtotal?: number
}

export interface ShopPersonalDiscountPreviewResult {
  success?: boolean
  error?: string
  hasExclusivePersonalRules?: boolean
  discountAmount?: number
  discountLabel?: string
  lines?: Pick<ClientDiscountLine, "productName" | "categoryName" | "discountPercent" | "discountAmount" | "source">[]
}

interface PromoDoc {
  id: string | number
  audience?: "all" | "individual" | "business" | null
  applicableProducts?: ({ id?: string | number } | string | number)[] | null
  discountType?: "percentage" | "fixed_amount"
  discountValue?: number
  isActive?: boolean
  isSingleUse?: boolean
  maxUses?: number | null
  currentUses?: number | null
  minOrderAmount?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  restrictedToEmail?: string | null
}

function relationshipId(value: { id?: string | number } | string | number) {
  return String(typeof value === "object" ? value.id ?? "" : value)
}

function buildValidatedCart(products: Product[], input: ShopOrderInput["items"]): CartItem[] {
  const result: CartItem[] = []
  for (const requested of input) {
    const quantity = Math.max(1, Math.min(100, Math.floor(Number(requested.quantity) || 0)))
    const product = products.find((entry) => entry.id === requested.productId)
    const variant = product?.variants?.find((entry) => entry.id === requested.variantId && entry.is_available !== false)
    if (!product || !variant) continue

    const grindOption = requested.grindOption && variant.grind_options.includes(requested.grindOption)
      ? requested.grindOption
      : variant.grind_options[0] || null

    result.push({
      id: requested.id,
      client_id: "",
      product_id: product.id,
      variant_id: variant.id,
      quantity,
      grind_option: grindOption,
      created_at: "",
      updated_at: "",
      product,
      variant,
    })
  }
  return result
}

async function resolvePromo(params: {
  payload: Awaited<ReturnType<typeof getPayload>>
  code?: string
  email: string
  cartItems: CartItem[]
  subtotal: number
}) {
  if (!params.code?.trim()) return { discountAmount: 0, discountLines: [] as { cartItemId: string; discountPercent: number }[] }

  const { docs } = await params.payload.find({
    collection: "promo-codes",
    where: { code: { equals: params.code.trim().toUpperCase() } },
    limit: 1,
    depth: 0,
  })
  const promo = docs[0] as PromoDoc | undefined
  if (!promo) throw new Error("Промокод не найден")
  if (!promo.isActive) throw new Error("Промокод неактивен")
  if ((promo.audience || "business") === "business") throw new Error("Промокод предназначен для юридических лиц")
  if (promo.startsAt && new Date(promo.startsAt) > new Date()) throw new Error("Промокод ещё не активен")
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) throw new Error("Промокод истёк")
  if (promo.maxUses != null && (promo.currentUses || 0) >= promo.maxUses) throw new Error("Промокод исчерпан")
  if (promo.restrictedToEmail && promo.restrictedToEmail.toLowerCase() !== params.email.toLowerCase()) throw new Error("Промокод привязан к другому email")
  if (promo.minOrderAmount && params.subtotal < promo.minOrderAmount) throw new Error(`Минимальная сумма заказа: ${promo.minOrderAmount.toLocaleString("ru-RU")} ₽`)

  if (promo.isSingleUse) {
    const previous = await params.payload.find({
      collection: "orders",
      where: {
        and: [
          { promoCode: { equals: promo.id } },
          { customerEmail: { equals: params.email.toLowerCase() } },
        ],
      },
      limit: 1,
      depth: 0,
    })
    if (previous.totalDocs > 0) throw new Error("Этот промокод уже использован")
  }

  const applicableIds = new Set((promo.applicableProducts || []).map(relationshipId).filter(Boolean))
  const eligibleItems = applicableIds.size === 0
    ? params.cartItems
    : params.cartItems.filter((item) => applicableIds.has(item.product_id))
  const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + (item.variant?.price || 0) * item.quantity, 0)
  if (eligibleSubtotal <= 0) throw new Error("В корзине нет товаров, участвующих в промокоде")

  const discountAmount = promo.discountType === "fixed_amount"
    ? Math.min(promo.discountValue || 0, eligibleSubtotal)
    : Math.round(eligibleSubtotal * (promo.discountValue || 0) / 100)
  const discountPercent = eligibleSubtotal > 0 ? Math.min(100, discountAmount / eligibleSubtotal * 100) : 0

  return {
    promo,
    discountAmount,
    eligibleSubtotal,
    discountLines: eligibleItems.map((item) => ({ cartItemId: item.id, discountPercent })),
  }
}

export async function previewShopPromo(input: ShopPromoPreviewInput): Promise<ShopPromoPreviewResult> {
  const code = input.promoCode.trim().toUpperCase()
  if (!code) return { error: "Введите промокод" }

  try {
    const [payload, products, personalConfig] = await Promise.all([
      getPayload({ config: configPromise }),
      getShopProducts(),
      getClientDiscountConfig("individual"),
    ])
    if (personalConfig.categoryDiscounts.length > 0 || (personalConfig.productDiscounts?.length || 0) > 0) {
      return { error: "Промокоды недоступны при персональной скидке на категорию или товар" }
    }
    const cartItems = buildValidatedCart(products, input.items)
    if (cartItems.length === 0) return { error: "Корзина пуста или товары больше недоступны" }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.variant?.price || 0) * item.quantity, 0)
    const result = await resolvePromo({
      payload,
      code,
      email: input.email?.trim().toLowerCase() || "",
      cartItems,
      subtotal,
    })
    if (!result.promo) return { error: "Промокод не найден" }

    return {
      success: true,
      code,
      discountAmount: result.discountAmount,
      eligibleSubtotal: result.eligibleSubtotal,
      discountLabel: result.promo.discountType === "fixed_amount"
        ? `${(result.promo.discountValue || 0).toLocaleString("ru-RU")} ₽`
        : `${result.promo.discountValue || 0}%`,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось проверить промокод" }
  }
}

export async function previewShopPersonalDiscount(
  items: ShopOrderInput["items"]
): Promise<ShopPersonalDiscountPreviewResult> {
  try {
    const [products, config] = await Promise.all([
      getShopProducts(),
      getClientDiscountConfig("individual"),
    ])
    const hasExclusivePersonalRules = config.categoryDiscounts.length > 0
      || (config.productDiscounts?.length || 0) > 0
    const cartItems = buildValidatedCart(products, items)
    if (cartItems.length === 0) return { success: true, hasExclusivePersonalRules, discountAmount: 0, lines: [] }

    const result = calculateClientDiscount(cartItems, config)
    return {
      success: true,
      hasExclusivePersonalRules,
      discountAmount: result.amount,
      discountLabel: result.label,
      lines: result.lines.map((line) => ({
        productName: line.productName,
        categoryName: line.categoryName,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        source: line.source,
      })),
    }
  } catch (error) {
    console.error("[shop-discounts] Не удалось рассчитать персональную скидку", error)
    return { error: "Не удалось загрузить персональную скидку" }
  }
}

export interface ShopOrderResult {
  success?: boolean
  error?: string
  warning?: string
  orderId?: string
  orderNumber?: string
  paymentUrl?: string
  paymentToken?: string
  paymentPendingSetup?: boolean
}

async function createShopOrderInternal(input: ShopOrderInput): Promise<ShopOrderResult> {
  const fullName = input.fullName.trim()
  const email = input.email.trim().toLowerCase()
  const phone = normalizeRussianPhone(input.phone)
  const address = input.address?.trim() || ""

  if (fullName.length < 2) return { error: "Введите ФИО" }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Введите корректный email" }
  if (!isValidRussianPhone(phone)) return { error: "Введите корректный телефон" }
  if (input.deliveryMethod !== "self_pickup" && !address) return { error: "Введите адрес доставки" }
  if (!input.acceptTerms) return { error: "Примите условия публичной оферты и доставки" }

  const [payload, products] = await Promise.all([
    getPayload({ config: configPromise }),
    getShopProducts(),
  ])
  const cartItems = buildValidatedCart(products, input.items)
  if (cartItems.length === 0) return { error: "Корзина пуста или товары больше недоступны" }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.variant?.price || 0) * item.quantity, 0)
  const totalWeight = cartItems.reduce((sum, item) => sum + (item.variant?.weight_grams || 0) * item.quantity, 0)

  let clientId: string | number | undefined
  let warning: string | undefined
  const auth = await createClient("individual")
  const { data: { user: currentUser } } = await auth.auth.getUser()

  if (currentUser) {
    const clients = await payload.find({
      collection: "clients",
      where: {
        or: [
          { supabaseId: { equals: currentUser.id } },
          ...(currentUser.email ? [{
            and: [
              { email: { equals: currentUser.email.toLowerCase() } },
              { customerType: { equals: "individual" } },
              { salesChannel: { equals: "retail" } },
            ],
          }] : []),
        ],
      },
      limit: 1,
      depth: 0,
    })
    const existingClient = clients.docs[0] as { id?: string | number; supabaseId?: string | null } | undefined
    if (existingClient?.id) {
      clientId = existingClient.id
      if (existingClient.supabaseId !== currentUser.id) {
        await payload.update({
          collection: "clients",
          id: existingClient.id,
          data: {
            supabaseId: currentUser.id,
            customerType: "individual",
            salesChannel: "retail",
          },
        })
      }
    } else {
      const createdClient = await payload.create({
        collection: "clients",
        data: {
          supabaseId: currentUser.id,
          fullName,
          email: currentUser.email || email,
          phone,
          address,
          customerType: "individual",
          salesChannel: "retail",
        },
      })
      clientId = createdClient.id
    }
  }

  if (!currentUser && input.createAccount) {
    const registration = await signUp({
      email,
      full_name: fullName,
      phone,
      address,
      customer_type: "individual",
    })
    if (registration?.error) {
      warning = `Заказ оформлен без регистрации: ${registration.error}`
    } else if (registration?.userId) {
      const clients = await payload.find({
        collection: "clients",
        where: { supabaseId: { equals: registration.userId } },
        limit: 1,
        depth: 0,
      })
      clientId = clients.docs[0]?.id
    }
  }

  const personalConfig = currentUser
    ? await getClientDiscountConfig("individual")
    : { discountPercent: 0, categoryDiscounts: [], productDiscounts: [] }
  const hasExclusivePersonalRules = personalConfig.categoryDiscounts.length > 0
    || (personalConfig.productDiscounts?.length || 0) > 0
  if (hasExclusivePersonalRules && input.promoCode?.trim()) {
    return { error: "Промокоды недоступны при персональной скидке на категорию или товар" }
  }

  let promoResult: Awaited<ReturnType<typeof resolvePromo>>
  try {
    promoResult = await resolvePromo({
      payload,
      code: hasExclusivePersonalRules ? undefined : input.promoCode,
      email,
      cartItems,
      subtotal,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Не удалось применить промокод" }
  }

  const personalDiscount = currentUser
    ? calculateClientDiscount(cartItems, personalConfig)
    : calculateClientDiscount(cartItems, { discountPercent: 0, categoryDiscounts: [], productDiscounts: [] })
  const promoWins = Boolean(
    promoResult.promo
    && promoResult.discountAmount >= personalDiscount.amount
    && promoResult.discountAmount > 0
  )
  const discountAmount = promoWins ? promoResult.discountAmount : personalDiscount.amount
  const appliedDiscountLines = promoWins
    ? promoResult.discountLines
    : personalDiscount.lines.map((line) => ({
        cartItemId: line.cartItemId,
        discountPercent: line.discountPercent,
      }))

  let deliveryCost = 0
  if (input.deliveryMethod === "cdek") {
    const cityCode = Number(input.cdekCityCode)
    if (!Number.isInteger(cityCode) || cityCode <= 0 || !input.cdekDeliveryType) {
      return { error: "Выберите город и способ доставки СДЭК" }
    }
    try {
      const tariffs = await calculateTariff(cityCode, totalWeight)
      const allowedModes = input.cdekDeliveryType === "courier" ? [1, 3] : [2, 4]
      const matchingTariffs = tariffs
        .filter((tariff) => allowedModes.includes(tariff.delivery_mode))
        .sort((left, right) => left.delivery_sum - right.delivery_sum)
      const tariff = matchingTariffs[0]
      if (!tariff) return { error: "Для выбранного способа доставки нет тарифа СДЭК" }
      deliveryCost = Math.round(tariff.delivery_sum)
    } catch (error) {
      console.error("[shop-orders] Не удалось проверить тариф СДЭК", error)
      return { error: "Не удалось подтвердить стоимость доставки СДЭК. Попробуйте ещё раз." }
    }
  }
  const total = Math.max(0, subtotal - discountAmount) + deliveryCost
  const items = cartItems.map((item) => {
    const stockLossLine = buildMoyskladStockLossLines([item])[0]
    const lineSubtotal = (item.variant?.price || 0) * item.quantity
    const personalLine = !promoWins
      ? personalDiscount.lines.find((line) => line.cartItemId === item.id)
      : undefined
    const promoLine = promoWins
      ? promoResult.discountLines.find((line) => line.cartItemId === item.id)
      : undefined
    const lineDiscountPercent = personalLine?.discountPercent || promoLine?.discountPercent || 0
    const lineDiscountAmount = personalLine?.discountAmount
      ?? (lineDiscountPercent > 0 ? Math.round(lineSubtotal * lineDiscountPercent / 100) : 0)
    return {
      productId: item.product?.id || "",
      productName: item.product?.name || "",
      variantName: item.variant?.name || "",
      grindOption: item.grind_option || "",
      quantity: item.quantity,
      unitPrice: item.variant?.price || 0,
      totalPrice: lineSubtotal,
      discountPercent: lineDiscountPercent,
      discountAmount: lineDiscountAmount,
      stockProductMoyskladId: stockLossLine?.productMoyskladId || "",
      stockQuantityKg: stockLossLine?.quantityKg || 0,
      stockPricePerKg: stockLossLine?.pricePerKg || 0,
    }
  })

  const orderData: Record<string, unknown> = {
    salesChannel: "retail",
    customerType: "individual",
    checkoutMode: clientId ? "account" : "guest",
    paymentMethod: "yookassa",
    paymentStatus: "pending",
    customerFullName: fullName,
    customerEmail: email,
    customerPhone: phone,
    deliveryMethod: input.deliveryMethod,
    deliveryAddress: address,
    subtotal,
    discountAmount,
    deliveryCost,
    total,
    totalWeightGrams: totalWeight,
    comment: input.comment?.trim() || "",
    items,
  }
  if (clientId) orderData.client = clientId
  if (promoWins && promoResult.promo) orderData.promoCode = promoResult.promo.id

  const order = await payload.create({ collection: "orders", data: orderData }) as {
    id: string | number
    orderId?: string
    createdAt?: string
    vatRate?: string | null
    vatCustomRate?: number | null
  }

  await syncOrderToMoysklad({
    payload,
    order: {
      id: order.id,
      orderId: order.orderId,
      salesChannel: "retail",
      customerType: "individual",
      createdAt: order.createdAt,
      subtotal,
      discountAmount,
      deliveryCost,
      total,
      deliveryMethod: input.deliveryMethod,
      deliveryAddress: address,
      comment: input.comment,
    },
    client: { fullName, email, phone },
    company: null,
    cartItems,
    discountLines: appliedDiscountLines,
  })

  if (promoWins && promoResult.promo) {
    await payload.update({
      collection: "promo-codes",
      id: promoResult.promo.id,
      data: { currentUses: (promoResult.promo.currentUses || 0) + 1 },
    })
  }

  const payment = await createYooKassaPayment({
    orderId: String(order.id),
    orderNumber: order.orderId || String(order.id),
    amountRubles: total,
    customerEmail: email,
    receiptItems: buildYooKassaReceiptItems({
      items,
      discountAmount,
      deliveryCost,
      vatRate: order.vatRate,
      vatCustomRate: order.vatCustomRate,
    }),
    description: `Заказ ${order.orderId || order.id} в 10coffee`,
  })

  if (payment.ok) {
    await payload.update({
      collection: "orders",
      id: order.id,
      data: {
        paymentExternalId: payment.paymentId,
        paymentUrl: payment.paymentUrl,
        paymentUpdatedAt: new Date().toISOString(),
      },
    })
  } else if (payment.code !== "not_configured") {
    console.error("Не удалось создать платёж YooKassa", {
      orderId: String(order.id),
      reason: payment.error,
    })
    warning = warning || "Заказ создан, но перейти к онлайн-оплате не удалось. Мы свяжемся с вами для уточнения оплаты."
  }

  return {
    success: true,
    warning,
    orderId: String(order.id),
    orderNumber: order.orderId || String(order.id),
    paymentUrl: payment.ok ? payment.paymentUrl : undefined,
    paymentToken: payment.ok ? createOrderPaymentToken(String(order.id)) : undefined,
    paymentPendingSetup: !payment.ok && payment.code === "not_configured",
  }
}

export async function createShopOrder(input: ShopOrderInput): Promise<ShopOrderResult> {
  try {
    return await createShopOrderInternal(input)
  } catch (error) {
    console.error("[shop-orders] Не удалось оформить розничный заказ", error)
    return {
      error: "Не удалось оформить заказ из-за временной ошибки сервера. Товары сохранены в корзине — попробуйте ещё раз.",
    }
  }
}
