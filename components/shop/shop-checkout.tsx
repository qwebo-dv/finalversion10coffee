"use client"

import Link from "next/link"
import Image from "next/image"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Car, CheckCircle2, ChevronDown, Loader2, LockKeyhole, MapPin, ShoppingBag, Store, Tag, X } from "lucide-react"
import { createShopOrder, previewShopPersonalDiscount, previewShopPromo, quoteShopSochiDelivery } from "@/lib/actions/shop-orders"
import { getMyLoyalty, type MyLoyaltyData } from "@/lib/actions/loyalty"
import type { SochiDeliveryQuote } from "@/lib/sochi-delivery"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { useAuth } from "@/providers/auth-provider"
import PhoneInput from "@/components/shared/phone-input"
import AddressInput from "@/components/shared/address-input"
import { PendingPaymentCard } from "@/components/shop/pending-payment-card"
import { formatPrice } from "@/lib/utils/format"
import { formatDeliveryDateRange, formatDeliveryDays } from "@/lib/utils/delivery-estimate"
import type { DeliveryMethod, Product } from "@/types"
import { CdekDeliverySelector, type ShopCdekSelection } from "./cdek-delivery-selector"
import { YandexDeliverySelector, type ShopYandexDeliverySelection } from "./yandex-delivery-selector"

function CdekLogo() {
  return <Image src="/brands/cdek.svg" alt="СДЭК" width={71} height={20} className="h-5 w-auto" />
}

function YandexDeliveryLogo() {
  return <span className="flex min-w-0 flex-col items-start gap-1 text-left leading-none"><Image src="/brands/yandex.svg" alt="Яндекс" width={68} height={17} className="h-4 max-w-full w-auto" /><span className="text-[12px] font-black text-[#1d1d1b]">Доставка</span></span>
}

function withCity(city: string, address: string): string {
  const trimmedAddress = address.trim()
  const normalizedCity = city.trim().toLocaleLowerCase("ru-RU")
  const alreadyHasCity = trimmedAddress.split(",").some((part) =>
    part.trim().toLocaleLowerCase("ru-RU").replace(/^г\.?\s+/, "") === normalizedCity,
  )
  return alreadyHasCity ? trimmedAddress : `${city}, ${trimmedAddress}`
}

export function ShopCheckout({
  products,
  onlinePaymentReady,
}: {
  products: Product[]
  onlinePaymentReady: boolean
}) {
  const { items, clearCart, hydrated, pendingPayment, setPendingPayment } = useGuestCart()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [redirectingToPayment, setRedirectingToPayment] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ orderNumber: string; warning?: string; paymentPendingSetup?: boolean } | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    (user?.user_metadata?.delivery_method as DeliveryMethod) || "cdek"
  )
  const [cdekSelection, setCdekSelection] = useState<ShopCdekSelection | null>(null)
  const [yandexSelection, setYandexSelection] = useState<ShopYandexDeliverySelection | null>(null)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [sochiDeliveryQuote, setSochiDeliveryQuote] = useState<SochiDeliveryQuote | null>(null)
  const [sochiDeliveryQuoteLoading, setSochiDeliveryQuoteLoading] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    discountAmount: number
    discountLabel: string
    eligibleSubtotal: number
  } | null>(null)
  const [personalDiscount, setPersonalDiscount] = useState<{
    discountAmount: number
    discountLabel: string
    lines: {
      productName?: string
      categoryName?: string
      discountPercent: number
      discountAmount: number
      source: "product" | "category" | "base"
    }[]
  } | null>(null)
  const [hasExclusivePersonalRules, setHasExclusivePersonalRules] = useState(false)
  const [discountRulesResolvedForUserId, setDiscountRulesResolvedForUserId] = useState<string | null>(null)
  const [loyalty, setLoyalty] = useState<MyLoyaltyData | null>(null)
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false)
  const [loyaltyPoints, setLoyaltyPoints] = useState(0)

  const defaultAddress = (user?.user_metadata?.address as string) || ""
  const isRetailAccountCheckout = user?.user_metadata?.customer_type === "individual"
  const hasPlaceholderEmail = user?.user_metadata?.email_is_placeholder === true

  useEffect(() => {
    const saved = user?.user_metadata?.delivery_method as DeliveryMethod | undefined
    // Auth state is hydrated asynchronously, so the saved delivery method must be applied after login data arrives.
    if (saved) setDeliveryMethod(saved)
  }, [user])

  useEffect(() => {
    if (!user || user.user_metadata?.customer_type !== "individual") return
    const profileName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""
    const profilePhone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : ""
    if (!fullName) setFullName(profileName)
    if (!phone) setPhone(profilePhone)
    if (!email && !hasPlaceholderEmail) setEmail(user.email || "")
  }, [email, fullName, hasPlaceholderEmail, phone, user])

  useEffect(() => {
    if (defaultAddress) setDeliveryAddress((current) => current || defaultAddress)
  }, [defaultAddress])

  useEffect(() => {
    let cancelled = false
    if (!isRetailAccountCheckout) {
      setLoyalty(null)
      return
    }
    void getMyLoyalty().then((response) => {
      if (!cancelled) setLoyalty(response)
    }).catch(() => {
      if (!cancelled) setLoyalty(null)
    })
    return () => { cancelled = true }
  }, [isRetailAccountCheckout, user?.id])

  const lines = useMemo(() => items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    return { item, product, variant }
  }).filter((line) => line.product && line.variant), [items, products])
  const subtotal = lines.reduce((sum, line) => sum + (line.variant?.price || 0) * line.item.quantity, 0)
  const totalWeight = lines.reduce((sum, line) => sum + (line.variant?.weight_grams || 0) * line.item.quantity, 0)
  const personalDiscountAmount = personalDiscount?.discountAmount || 0
  const promoIsApplied = Boolean(appliedPromo && appliedPromo.discountAmount >= personalDiscountAmount)
  const personalDiscountIsApplied = personalDiscountAmount > 0 && !promoIsApplied
  const appliedDiscountAmount = promoIsApplied ? appliedPromo?.discountAmount || 0 : personalDiscountAmount
  const coffeeSubtotal = lines.filter((line) => line.product?.product_type_schema === "coffee").reduce((sum, line) => sum + (line.variant?.price || 0) * line.item.quantity, 0)
  // Наличие персонального правила само по себе не должно запрещать списание.
  // Баллы несовместимы только со скидкой, которая действительно применена
  // к текущей корзине, либо с применённым промокодом.
  const loyaltyBlocked = promoIsApplied || personalDiscountIsApplied
  const loyaltyMaximum = loyalty?.enabled && !loyaltyBlocked
    ? Math.min(loyalty.available, Math.floor(coffeeSubtotal * loyalty.maxRedemptionPercent / 100))
    : 0
  const loyaltyDiscount = useLoyaltyPoints && !loyaltyBlocked ? Math.min(loyaltyPoints, loyaltyMaximum) : 0
  const discountAmount = appliedDiscountAmount + loyaltyDiscount
  const goodsTotal = Math.max(0, subtotal - discountAmount)
  const deliveryCost = deliveryMethod === "cdek"
    ? cdekSelection?.deliveryCost || 0
    : deliveryMethod === "sochi_delivery"
      ? sochiDeliveryQuote?.available ? sochiDeliveryQuote.cost : 0
      : deliveryMethod === "yandex_delivery"
        ? yandexSelection?.deliveryCost || 0
      : 0
  const total = Math.max(0, subtotal - discountAmount) + deliveryCost
  const cashbackBase = Math.max(0, subtotal - discountAmount)
  const cashbackTier = loyalty?.tiers.filter((tier) => cashbackBase >= tier.minSubtotal).at(-1)
  const expectedCashback = loyalty?.enabled ? Math.floor(cashbackBase * (cashbackTier?.percent || 0) / 100) : 0
  const cdekEstimate = cdekSelection ? formatDeliveryDays(cdekSelection.minDays, cdekSelection.maxDays) : null
  const yandexEstimate = yandexSelection ? formatDeliveryDateRange(yandexSelection.deliveryFrom, yandexSelection.deliveryTo) : null

  useEffect(() => {
    let cancelled = false
    if (!user || items.length === 0) {
      setPersonalDiscount(null)
      setHasExclusivePersonalRules(false)
      setDiscountRulesResolvedForUserId(null)
      return
    }

    void previewShopPersonalDiscount(items).then((response) => {
      if (cancelled) return
      setHasExclusivePersonalRules(response.hasExclusivePersonalRules === true)
      setDiscountRulesResolvedForUserId(user.id)
      if (response.hasExclusivePersonalRules) {
        setAppliedPromo(null)
        setPromoCode("")
        setPromoError(null)
      }
      if (!response.success || !response.discountAmount || !response.lines?.length) {
        setPersonalDiscount(null)
        return
      }
      setPersonalDiscount({
        discountAmount: response.discountAmount,
        discountLabel: response.discountLabel || "Персональная скидка",
        lines: response.lines,
      })
    })

    return () => {
      cancelled = true
    }
  }, [items, user])

  useEffect(() => {
    if (loyaltyBlocked) {
      setUseLoyaltyPoints(false)
      setLoyaltyPoints(0)
    }
  }, [loyaltyBlocked])

  useEffect(() => {
    setLoyaltyPoints((current) => Math.min(current, loyaltyMaximum))
  }, [loyaltyMaximum])

  useEffect(() => {
    if (deliveryMethod !== "sochi_delivery") {
      setSochiDeliveryQuote(null)
      setSochiDeliveryQuoteLoading(false)
      return
    }

    const address = deliveryAddress.trim()
    if (address.length < 4) {
      setSochiDeliveryQuote(null)
      setSochiDeliveryQuoteLoading(false)
      return
    }

    let cancelled = false
    setSochiDeliveryQuoteLoading(true)
    const timeout = window.setTimeout(() => {
      void quoteShopSochiDelivery({ address, goodsAmount: goodsTotal }).then((quote) => {
        if (!cancelled) setSochiDeliveryQuote(quote)
      }).catch(() => {
        if (!cancelled) setSochiDeliveryQuote({ available: false, cost: 0, zone: null, message: "Не удалось рассчитать доставку. Попробуйте ещё раз." })
      }).finally(() => {
        if (!cancelled) setSochiDeliveryQuoteLoading(false)
      })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [deliveryAddress, deliveryMethod, goodsTotal])

  function resetPromo() {
    setAppliedPromo(null)
    setPromoError(null)
  }

  async function applyPromo() {
    const normalized = promoCode.trim().toUpperCase()
    if (!normalized) {
      setPromoError("Введите промокод")
      return
    }

    if (useLoyaltyPoints) {
      setUseLoyaltyPoints(false)
      setLoyaltyPoints(0)
    }

    setPromoLoading(true)
    setPromoError(null)
    try {
      const response = await previewShopPromo({ items, promoCode: normalized, email })
      if (!response.success || !response.code || response.discountAmount == null) {
        setAppliedPromo(null)
        setPromoError(response.error || "Промокод не применён")
        return
      }
      setPromoCode(response.code)
      setAppliedPromo({
        code: response.code,
        discountAmount: response.discountAmount,
        discountLabel: response.discountLabel || "Скидка",
        eligibleSubtotal: response.eligibleSubtotal || subtotal,
      })
    } catch {
      setAppliedPromo(null)
      setPromoError("Не удалось проверить промокод. Попробуйте ещё раз.")
    } finally {
      setPromoLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    if (promoCode.trim() && !appliedPromo) {
      setLoading(false)
      setPromoError("Нажмите «Применить», чтобы проверить промокод")
      return
    }
    if (deliveryMethod === "cdek" && !cdekSelection) {
      setLoading(false)
      setError("Выберите город, способ и пункт выдачи СДЭК либо адрес курьерской доставки")
      return
    }
    if (deliveryMethod === "sochi_delivery" && (!sochiDeliveryQuote || !sochiDeliveryQuote.available)) {
      setLoading(false)
      setError(sochiDeliveryQuote?.message || "Дождитесь расчёта доставки по Сочи")
      return
    }
    if (deliveryMethod === "yandex_delivery" && !yandexSelection) {
      setLoading(false)
      setError("Выберите город, способ и точку получения Яндекс Доставки, затем дождитесь расчёта тарифа")
      return
    }
    try {
      const response = await createShopOrder({
        items,
        fullName,
        email,
        phone,
        address: deliveryMethod === "cdek" && cdekSelection?.deliveryType === "pickup"
          ? `ПВЗ СДЭК: ${cdekSelection.office?.name || ""} — ${cdekSelection.office?.address || ""}`
          : deliveryMethod === "cdek" && cdekSelection
            ? withCity(cdekSelection.cityName, String(data.get("address") || ""))
            : deliveryMethod === "sochi_delivery"
              ? withCity("Сочи", String(data.get("address") || ""))
              : deliveryMethod === "yandex_delivery"
                ? yandexSelection?.address || ""
              : String(data.get("address") || ""),
        deliveryMethod,
        comment: String(data.get("comment") || ""),
        promoCode: appliedPromo?.code || "",
        loyaltyPoints: loyaltyDiscount,
        createAccount: !isRetailAccountCheckout && data.get("createAccount") === "on",
        acceptTerms: data.get("acceptTerms") === "on",
        deliveryCost,
        cdekCityCode: cdekSelection?.cityCode,
        cdekDeliveryType: cdekSelection?.deliveryType,
        yandexDeliveryType: yandexSelection?.deliveryType,
        yandexPickupPointId: yandexSelection?.pickupPoint?.id,
        yandexPickupPointName: yandexSelection?.pickupPoint
          ? `${yandexSelection.pickupPoint.name} — ${yandexSelection.pickupPoint.address}`
          : undefined,
        yandexDestinationGeoId: yandexSelection?.destinationGeoId,
      })

      if (response.error) {
        setError(response.error)
        return
      }

      if (response.paymentUrl && response.paymentToken && response.orderId) {
        setRedirectingToPayment(true)
        setPendingPayment({
          orderId: response.orderId,
          orderNumber: response.orderNumber || response.orderId,
          token: response.paymentToken,
          paymentUrl: response.paymentUrl,
        })
        window.location.assign(response.paymentUrl)
        return
      }

      clearCart()
      setResult({
        orderNumber: response.orderNumber || response.orderId || "",
        warning: response.warning,
        paymentPendingSetup: response.paymentPendingSetup,
      })
    } catch (caught) {
      console.error("[shop-checkout] order creation failed", caught)
      setError("Не удалось оформить заказ. Попробуйте ещё раз. Если ошибка повторится, сообщите нам — товары останутся в корзине.")
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5">
        <div className="w-full max-w-xl rounded-[32px] bg-white p-8 text-center shadow-[0_24px_80px_rgba(45,27,17,0.1)] sm:p-12">
          <CheckCircle2 className="mx-auto h-16 w-16 text-[#5b328a]" />
          <h1 className="mt-6 text-3xl font-black tracking-tight">Заказ {result.orderNumber} принят</h1>
          <p className="mt-3 text-sm leading-6 text-[#756b63]">Заказ сохранён. Подтверждение на почту будет отправлено только после успешной оплаты.</p>
          {result.paymentPendingSetup && <div className="mt-6 rounded-2xl bg-[#fff4e8] p-4 text-sm text-[#8a4b1c]">Эквайринг работает в режиме подготовки. Платёжная ссылка появится после подключения реквизитов YooKassa.</div>}
          {result.warning && <div className="mt-4 rounded-2xl bg-[#fff4e8] p-4 text-sm text-[#8a4b1c]">{result.warning}</div>}
          <Link href="/shop" className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#5b328a] px-6 text-sm font-bold text-white">Вернуться в каталог</Link>
        </div>
      </main>
    )
  }

  if (redirectingToPayment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5" aria-live="polite">
        <div className="w-full max-w-xl rounded-[32px] bg-white p-8 text-center shadow-[0_24px_80px_rgba(45,27,17,0.1)] sm:p-12">
          <Loader2 className="mx-auto h-14 w-14 animate-spin text-[#5b328a]" />
          <h1 className="mt-6 text-2xl font-black tracking-tight">Переходим к безопасной оплате</h1>
          <p className="mt-3 text-sm leading-6 text-[#756b63]">Заказ создан. Сейчас откроется защищённая платёжная страница YooKassa.</p>
          <p className="mt-5 text-xs text-[#9a9088]">Пожалуйста, не закрывайте страницу.</p>
        </div>
      </main>
    )
  }

  if (hydrated && pendingPayment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5">
        <div className="w-full max-w-xl rounded-[32px] bg-white p-8 shadow-[0_24px_80px_rgba(45,27,17,0.1)] sm:p-10">
          <h1 className="text-center text-3xl font-black tracking-tight">Заказ уже ожидает оплаты</h1>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-[#756b63]">Чтобы не создавать дубликат, завершите оплату текущего заказа или откажитесь от него.</p>
          <div className="mt-7"><PendingPaymentCard /></div>
          <Link href="/shop" className="mx-auto mt-3 flex w-fit items-center gap-2 text-sm font-bold text-[#5b328a]"><ArrowLeft className="h-4 w-4" /> Вернуться в каталог</Link>
        </div>
      </main>
    )
  }

  if (hydrated && lines.length === 0) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5"><div className="text-center"><ShoppingBag className="mx-auto h-12 w-12 text-[#b4aaa2]" /><h1 className="mt-4 text-2xl font-black">Корзина пуста</h1><Link href="/shop" className="mt-6 inline-flex rounded-full bg-[#5b328a] px-6 py-3 text-sm font-bold text-white">Перейти в каталог</Link></div></main>
  }

  return (
    <main className="min-h-screen bg-[#f8f5f1] px-5 py-8 text-[#1d1d1b] lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-bold text-[#6f655e]"><ArrowLeft className="h-4 w-4" /> Вернуться в каталог</Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
          <form onSubmit={submit} className="rounded-[32px] bg-white p-6 shadow-[0_20px_70px_rgba(45,27,17,0.07)] sm:p-9">
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Детали заказа</h1>

            {error && <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold text-[#655c55]">ФИО</span><input name="fullName" required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" placeholder="Иванов Иван Иванович" /></label>
              <label><span className="mb-2 block text-xs font-bold text-[#655c55]">Телефон</span><PhoneInput name="phone" required value={phone} onChange={setPhone} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" /></label>
              <label><span className="mb-2 block text-xs font-bold text-[#655c55]">Email</span><input name="email" type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); if (appliedPromo) resetPromo() }} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" placeholder="mail@example.ru" /></label>
            </div>

            <fieldset className="mt-8">
              <legend className="text-sm font-black">Способ получения</legend>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <button type="button" aria-pressed={deliveryMethod === "cdek"} onClick={() => { setDeliveryMethod("cdek"); setCdekSelection(null); setYandexSelection(null) }} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${deliveryMethod === "cdek" ? "border-[#5b328a] bg-[#f4edfa]" : "border-black/10 hover:border-black/25"}`}>
                  <CdekLogo />
                  <span className="mt-4 block text-xs font-medium text-[#655c55]">{cdekEstimate ? `${cdekEstimate} · ${formatPrice(cdekSelection?.deliveryCost || 0)}` : "ПВЗ или курьер"}</span>
                </button>
                <button type="button" aria-pressed={deliveryMethod === "yandex_delivery"} onClick={() => { setDeliveryMethod("yandex_delivery"); setCdekSelection(null); setYandexSelection(null) }} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${deliveryMethod === "yandex_delivery" ? "border-[#5b328a] bg-[#f4edfa]" : "border-black/10 hover:border-black/25"}`}>
                  <YandexDeliveryLogo />
                  <span className="mt-3 block text-xs font-medium text-[#655c55]">{yandexEstimate ? `${yandexEstimate} · ${formatPrice(yandexSelection?.deliveryCost || 0)}` : "ПВЗ, постамат или курьер"}</span>
                </button>
                <button type="button" aria-pressed={deliveryMethod === "sochi_delivery"} onClick={() => { setDeliveryMethod("sochi_delivery"); setCdekSelection(null); setYandexSelection(null) }} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${deliveryMethod === "sochi_delivery" ? "border-[#5b328a] bg-[#f4edfa]" : "border-black/10 hover:border-black/25"}`}>
                  <span className="flex items-center gap-2 text-sm font-black"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#5b328a] text-white"><Car className="h-4 w-4" /></span>По Сочи</span>
                  <span className="mt-3 block text-xs font-medium text-[#655c55]">{sochiDeliveryQuote?.available ? (sochiDeliveryQuote.cost > 0 ? formatPrice(sochiDeliveryQuote.cost) : "Бесплатно") : "По зонам города"}</span>
                </button>
                <button type="button" aria-pressed={deliveryMethod === "self_pickup"} onClick={() => { setDeliveryMethod("self_pickup"); setCdekSelection(null); setYandexSelection(null) }} className={`min-h-24 rounded-2xl border p-4 text-left transition-colors ${deliveryMethod === "self_pickup" ? "border-[#5b328a] bg-[#f4edfa]" : "border-black/10 hover:border-black/25"}`}>
                  <span className="flex items-center gap-2 text-sm font-black"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#1d1d1b] text-white"><Store className="h-4 w-4" /></span>Самовывоз</span>
                  <span className="mt-3 block text-xs font-medium text-[#655c55]">Бесплатно · Сочи</span>
                </button>
              </div>
            </fieldset>

            {deliveryMethod === "cdek" && <CdekDeliverySelector items={items} weightGrams={totalWeight} defaultAddress={defaultAddress} onChange={setCdekSelection} />}
            {deliveryMethod === "yandex_delivery" && <YandexDeliverySelector items={items} fullName={fullName} email={email} phone={phone} defaultAddress={defaultAddress} onChange={setYandexSelection} />}
            {deliveryMethod === "sochi_delivery" && <div className="mt-5"><label className="block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Адрес доставки</span><AddressInput name="address" required value={deliveryAddress} onChange={setDeliveryAddress} region="Краснодарский" className="h-12 rounded-2xl border-black/10 px-4 focus-visible:border-[#5b328a] focus-visible:ring-0" placeholder="Начните вводить улицу и дом" /></label>{sochiDeliveryQuoteLoading && <p className="mt-2 text-xs text-[#756b63]">Рассчитываем доставку по адресу…</p>}{!sochiDeliveryQuoteLoading && sochiDeliveryQuote?.available && <p className="mt-2 text-xs font-medium text-emerald-700">{sochiDeliveryQuote.cost > 0 ? `Доставка по этой зоне — ${formatPrice(sochiDeliveryQuote.cost)}` : "Доставка бесплатная"}{goodsTotal >= 3000 && " для заказа от 3 000 ₽"}</p>}{!sochiDeliveryQuoteLoading && sochiDeliveryQuote && !sochiDeliveryQuote.available && <p className="mt-2 text-xs font-medium text-red-700">{sochiDeliveryQuote.message}</p>}</div>}
            {deliveryMethod === "self_pickup" && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#5b328a]/20 bg-[#f4edfa] p-4 text-[#5b328a]">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">Адрес самовывоза</p>
                  <address className="mt-1 text-sm not-italic leading-6">г. Сочи, ул. Пластунская, 79/1, пом. 1</address>
                </div>
              </div>
            )}
            <label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Комментарий</span><textarea name="comment" rows={3} className="w-full rounded-2xl border border-black/10 p-4 outline-none focus:border-[#5b328a]" placeholder="Пожелания к заказу" /></label>
            {!hasExclusivePersonalRules && (!user || discountRulesResolvedForUserId === user.id) && <details className="group mt-5 rounded-2xl border border-black/10 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#655c55] [&::-webkit-details-marker]:hidden">
                <span>{appliedPromo ? `Промокод ${appliedPromo.code} ${promoIsApplied ? "применён" : "проверен"}` : "У меня есть промокод"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-black/10 p-4">
              <div className="flex gap-2">
                <input
                  name="promoCode"
                  value={promoCode}
                  onChange={(event) => {
                    const nextCode = event.target.value.toUpperCase()
                    setPromoCode(nextCode)
                    if (appliedPromo?.code !== nextCode.trim()) resetPromo()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void applyPromo()
                    }
                  }}
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-black/10 px-4 uppercase outline-none focus:border-[#5b328a]"
                  placeholder="Введите код"
                  aria-describedby="promo-status"
                />
                <button
                  type="button"
                  onClick={() => void applyPromo()}
                  disabled={promoLoading || !promoCode.trim()}
                  className="h-12 shrink-0 rounded-2xl bg-[#5b328a] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {promoLoading ? "Проверяем…" : "Применить"}
                </button>
              </div>
              <div id="promo-status" aria-live="polite">
                {promoError && <p className="mt-2 text-sm font-medium text-red-600">{promoError}</p>}
                {appliedPromo && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                    <div className="flex min-w-0 items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-black">Промокод {appliedPromo.code} проверен</p>
                        <p className="mt-0.5 text-xs">Скидка {appliedPromo.discountLabel}: −{formatPrice(appliedPromo.discountAmount)}{personalDiscountIsApplied ? ". Персональная скидка выгоднее." : " и применена к заказу."}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setPromoCode(""); resetPromo() }} className="rounded-full p-1.5 hover:bg-emerald-100" aria-label="Удалить промокод"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              </div>
            </details>}

            {isRetailAccountCheckout && loyalty?.enabled && (
              <section className="mt-5 rounded-2xl border border-[#5b328a]/20 bg-[#f8f4fb] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={useLoyaltyPoints}
                    disabled={loyaltyBlocked || loyaltyMaximum < 1}
                    onChange={(event) => {
                      const checked = event.target.checked
                      if (checked) {
                        setAppliedPromo(null)
                        setPromoCode("")
                        setPromoError(null)
                      }
                      setUseLoyaltyPoints(checked)
                      if (!checked) setLoyaltyPoints(0)
                      else setLoyaltyPoints(loyaltyMaximum)
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#5b328a]"
                  />
                  <span>
                    <b className="block text-sm text-[#5b328a]">Списать баллы</b>
                    <span className="mt-1 block text-xs leading-5 text-[#655c55]">
                      Доступно {loyalty.available.toLocaleString("ru-RU")} Б. За кофе можно списать до {loyalty.maxRedemptionPercent}% — максимум {loyaltyMaximum.toLocaleString("ru-RU")} Б.
                    </span>
                  </span>
                </label>
                {loyaltyBlocked && <p className="mt-3 text-xs leading-5 text-[#8a4b1c]">Баллы не суммируются с применённым промокодом или персональной скидкой.</p>}
                {useLoyaltyPoints && !loyaltyBlocked && (
                  <div className="mt-4">
                    <label className="text-xs font-bold text-[#655c55]" htmlFor="loyalty-points">Списать баллов</label>
                    <div className="mt-2 flex items-center gap-3">
                      <input id="loyalty-points" type="number" min={1} max={loyaltyMaximum} value={loyaltyPoints || ""} onChange={(event) => setLoyaltyPoints(Math.max(0, Math.min(loyaltyMaximum, Math.floor(Number(event.target.value) || 0))))} className="h-11 w-28 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:border-[#5b328a]" />
                      <input aria-label="Количество списываемых баллов" type="range" min={0} max={loyaltyMaximum} value={loyaltyPoints} onChange={(event) => setLoyaltyPoints(Number(event.target.value))} className="min-w-0 flex-1 accent-[#5b328a]" />
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs leading-5 text-[#655c55]">После доставки ожидаемое начисление: {expectedCashback.toLocaleString("ru-RU")} Б.</p>
              </section>
            )}

            {!isRetailAccountCheckout && <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f8f5f1] p-4"><input name="createAccount" type="checkbox" className="mt-1 h-4 w-4 accent-[#5b328a]" /><span><b className="block text-sm">Создать личный кабинет</b><span className="mt-1 block text-xs leading-5 text-[#7d736b]">Необязательно. Пароль будет отправлен на email, а заказ появится в истории.</span></span></label>}

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-black/10 p-4">
              <input name="acceptTerms" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[#5b328a]" />
              <span className="text-xs leading-5 text-[#655c55]">
                Я принимаю условия <Link href="/oferta" target="_blank" className="font-bold text-[#5b328a] underline underline-offset-2">публичной оферты</Link>, ознакомлен с <Link href="/delivery" target="_blank" className="font-bold text-[#5b328a] underline underline-offset-2">условиями доставки</Link>, <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5b328a] underline underline-offset-2">политикой конфиденциальности</a> и <a href="/Политика обработки персональных данных пользователей сайта.pdf" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5b328a] underline underline-offset-2">правилами обработки персональных данных</a>.
              </span>
            </label>

            <div className="mt-8 rounded-2xl border border-dashed border-[#5b328a]/30 bg-[#f8f4fb] p-4 text-sm text-[#5b328a]">
              <div className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                {onlinePaymentReady ? (
                  <p><b>Безопасная онлайн-оплата через YooKassa.</b><br />После оформления заказа вы перейдёте на защищённую страницу оплаты.</p>
                ) : (
                  <p><b>Онлайн-оплата временно недоступна.</b><br />Заказ будет создан без списания денег, а менеджер свяжется с вами.</p>
                )}
              </div>
            </div>
            <button disabled={loading || !hydrated || (deliveryMethod === "cdek" && !cdekSelection) || (deliveryMethod === "yandex_delivery" && !yandexSelection)} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#5b328a] text-sm font-black text-white hover:bg-[#47256e] disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Оформляем…" : `Оформить заказ · ${formatPrice(total)}`}</button>
          </form>

          <aside className="h-fit rounded-[32px] bg-[#1d1d1b] p-6 text-white lg:sticky lg:top-8">
            <h2 className="text-xl font-black">Ваш заказ</h2>
            <div className="mt-5 space-y-4">{lines.map(({ item, product, variant }) => <div key={item.id} className="flex gap-3 border-b border-white/10 pb-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product?.name}</p><p className="mt-1 text-xs text-white/50">{variant?.name} · {item.quantity} шт.</p></div><b className="text-sm">{formatPrice((variant?.price || 0) * item.quantity)}</b></div>)}</div>
            {discountAmount > 0 && <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-emerald-300"><Tag className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{loyaltyDiscount > 0 ? "Списание баллов" : promoIsApplied ? `Промокод ${appliedPromo?.code}` : "Персональная скидка"}</span><strong className="text-sm">−{formatPrice(discountAmount)}</strong></div>}
            <div className="mt-6 space-y-2 border-t border-white/10 pt-5"><div className="flex items-end justify-between"><span className="text-sm text-white/55">Товары</span><strong>{formatPrice(subtotal)}</strong></div>{appliedDiscountAmount > 0 && <div className="flex items-end justify-between text-emerald-300"><span className="text-sm">{promoIsApplied ? "Скидка по промокоду" : "Персональная скидка"}</span><strong>−{formatPrice(appliedDiscountAmount)}</strong></div>}{loyaltyDiscount > 0 && <div className="flex items-end justify-between text-emerald-300"><span className="text-sm">Списание баллов</span><strong>−{formatPrice(loyaltyDiscount)}</strong></div>}{(deliveryCost > 0 || (deliveryMethod === "sochi_delivery" && sochiDeliveryQuote?.available)) && <div className="flex items-end justify-between"><span className="text-sm text-white/55">{deliveryMethod === "sochi_delivery" ? "Доставка по Сочи" : deliveryMethod === "yandex_delivery" ? "Яндекс Доставка" : "Доставка СДЭК"}</span><strong>{deliveryCost > 0 ? formatPrice(deliveryCost) : "Бесплатно"}</strong></div>}<div className="flex items-end justify-between pt-2"><span className="text-sm text-white/55">Итого</span><strong className="text-2xl">{formatPrice(total)}</strong></div></div>
          </aside>
        </div>
      </div>
    </main>
  )
}
