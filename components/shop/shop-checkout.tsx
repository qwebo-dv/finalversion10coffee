"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, ChevronDown, Loader2, LockKeyhole, MapPin, ShoppingBag, Tag, X } from "lucide-react"
import { createShopOrder, previewShopPromo } from "@/lib/actions/shop-orders"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { useAuth } from "@/providers/auth-provider"
import PhoneInput from "@/components/shared/phone-input"
import AddressInput from "@/components/shared/address-input"
import { PendingPaymentCard } from "@/components/shop/pending-payment-card"
import { formatPrice } from "@/lib/utils/format"
import type { DeliveryMethod, Product } from "@/types"
import { CdekDeliverySelector, type ShopCdekSelection } from "./cdek-delivery-selector"

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
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    discountAmount: number
    discountLabel: string
    eligibleSubtotal: number
  } | null>(null)

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

  const lines = useMemo(() => items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    return { item, product, variant }
  }).filter((line) => line.product && line.variant), [items, products])
  const subtotal = lines.reduce((sum, line) => sum + (line.variant?.price || 0) * line.item.quantity, 0)
  const totalWeight = lines.reduce((sum, line) => sum + (line.variant?.weight_grams || 0) * line.item.quantity, 0)
  const deliveryCost = deliveryMethod === "cdek" ? cdekSelection?.deliveryCost || 0 : 0
  const discountAmount = appliedPromo?.discountAmount || 0
  const total = Math.max(0, subtotal - discountAmount) + deliveryCost

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
              : String(data.get("address") || ""),
        deliveryMethod,
        comment: String(data.get("comment") || ""),
        promoCode: appliedPromo?.code || "",
        createAccount: !isRetailAccountCheckout && data.get("createAccount") === "on",
        acceptTerms: data.get("acceptTerms") === "on",
        deliveryCost,
        cdekCityCode: cdekSelection?.cityCode,
        cdekDeliveryType: cdekSelection?.deliveryType,
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

            <fieldset className="mt-8"><legend className="text-sm font-black">Способ получения</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{([['cdek','СДЭК'],['sochi_delivery','По Сочи'],['self_pickup','Самовывоз']] as [DeliveryMethod,string][]).map(([value,label]) => <button key={value} type="button" onClick={() => { setDeliveryMethod(value); setCdekSelection(null) }} className={`rounded-2xl border px-4 py-4 text-sm font-bold ${deliveryMethod === value ? "border-[#5b328a] bg-[#f4edfa] text-[#5b328a]" : "border-black/10"}`}>{label}</button>)}</div></fieldset>

            {deliveryMethod === "cdek" && <CdekDeliverySelector weightGrams={totalWeight} defaultAddress={defaultAddress} onChange={setCdekSelection} />}
            {deliveryMethod === "sochi_delivery" && <label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Адрес доставки</span><AddressInput name="address" required value={deliveryAddress} onChange={setDeliveryAddress} city="Сочи" className="h-12 rounded-2xl border-black/10 px-4 focus-visible:border-[#5b328a] focus-visible:ring-0" placeholder="Начните вводить улицу и дом" /></label>}
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
            <details className="group mt-5 rounded-2xl border border-black/10 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#655c55] [&::-webkit-details-marker]:hidden">
                <span>{appliedPromo ? `Промокод ${appliedPromo.code} применён` : "У меня есть промокод"}</span>
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
                        <p className="text-sm font-black">Промокод {appliedPromo.code} применён</p>
                        <p className="mt-0.5 text-xs">Скидка {appliedPromo.discountLabel}: −{formatPrice(appliedPromo.discountAmount)}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setPromoCode(""); resetPromo() }} className="rounded-full p-1.5 hover:bg-emerald-100" aria-label="Удалить промокод"><X className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              </div>
            </details>

            {!isRetailAccountCheckout && <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f8f5f1] p-4"><input name="createAccount" type="checkbox" className="mt-1 h-4 w-4 accent-[#5b328a]" /><span><b className="block text-sm">Создать личный кабинет</b><span className="mt-1 block text-xs leading-5 text-[#7d736b]">Необязательно. Пароль будет отправлен на email, а заказ появится в истории.</span></span></label>}

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-black/10 p-4">
              <input name="acceptTerms" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[#5b328a]" />
              <span className="text-xs leading-5 text-[#655c55]">
                Я принимаю условия <Link href="/oferta" target="_blank" className="font-bold text-[#5b328a] underline underline-offset-2">публичной оферты</Link>, ознакомлен с <Link href="/delivery" target="_blank" className="font-bold text-[#5b328a] underline underline-offset-2">условиями доставки</Link> и <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5b328a] underline underline-offset-2">политикой конфиденциальности</a>.
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
            <button disabled={loading || !hydrated || (deliveryMethod === "cdek" && !cdekSelection)} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#5b328a] text-sm font-black text-white hover:bg-[#47256e] disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Оформляем…" : `Оформить заказ · ${formatPrice(total)}`}</button>
          </form>

          <aside className="h-fit rounded-[32px] bg-[#1d1d1b] p-6 text-white lg:sticky lg:top-8">
            <h2 className="text-xl font-black">Ваш заказ</h2>
            <div className="mt-5 space-y-4">{lines.map(({ item, product, variant }) => <div key={item.id} className="flex gap-3 border-b border-white/10 pb-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product?.name}</p><p className="mt-1 text-xs text-white/50">{variant?.name} · {item.quantity} шт.</p></div><b className="text-sm">{formatPrice((variant?.price || 0) * item.quantity)}</b></div>)}</div>
            {appliedPromo && <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-emerald-300"><Tag className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{appliedPromo.code}</span><strong className="text-sm">−{formatPrice(discountAmount)}</strong></div>}
            <div className="mt-6 space-y-2 border-t border-white/10 pt-5"><div className="flex items-end justify-between"><span className="text-sm text-white/55">Товары</span><strong>{formatPrice(subtotal)}</strong></div>{appliedPromo && <div className="flex items-end justify-between text-emerald-300"><span className="text-sm">Скидка по промокоду</span><strong>−{formatPrice(discountAmount)}</strong></div>}{deliveryCost > 0 && <div className="flex items-end justify-between"><span className="text-sm text-white/55">Доставка СДЭК</span><strong>{formatPrice(deliveryCost)}</strong></div>}<div className="flex items-end justify-between pt-2"><span className="text-sm text-white/55">Итого</span><strong className="text-2xl">{formatPrice(total)}</strong></div></div>
          </aside>
        </div>
      </div>
    </main>
  )
}
