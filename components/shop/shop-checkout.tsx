"use client"

import Link from "next/link"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, ShoppingBag } from "lucide-react"
import { createShopOrder } from "@/lib/actions/shop-orders"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { useAuth } from "@/providers/auth-provider"
import PhoneInput from "@/components/shared/phone-input"
import { formatPrice } from "@/lib/utils/format"
import type { DeliveryMethod, Product } from "@/types"

export function ShopCheckout({
  products,
  onlinePaymentReady,
}: {
  products: Product[]
  onlinePaymentReady: boolean
}) {
  const { items, clearCart, hydrated } = useGuestCart()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ orderNumber: string; warning?: string; paymentPendingSetup?: boolean } | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    (user?.user_metadata?.delivery_method as DeliveryMethod) || "cdek"
  )

  const defaultPhone = user?.user_metadata?.phone || ""
  const defaultAddress = (user?.user_metadata?.address as string) || ""
  const defaultName = user?.user_metadata?.full_name || ""
  const defaultEmail = user?.email || ""

  useEffect(() => {
    const saved = user?.user_metadata?.delivery_method as DeliveryMethod | undefined
    // Auth state is hydrated asynchronously, so the saved delivery method must be applied after login data arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDeliveryMethod(saved)
  }, [user])

  const lines = useMemo(() => items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    return { item, product, variant }
  }).filter((line) => line.product && line.variant), [items, products])
  const subtotal = lines.reduce((sum, line) => sum + (line.variant?.price || 0) * line.item.quantity, 0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const data = new FormData(event.currentTarget)

    const response = await createShopOrder({
      items,
      fullName: String(data.get("fullName") || ""),
      email: String(data.get("email") || ""),
      phone: String(data.get("phone") || ""),
      address: String(data.get("address") || ""),
      deliveryMethod,
      comment: String(data.get("comment") || ""),
      promoCode: String(data.get("promoCode") || ""),
      createAccount: data.get("createAccount") === "on",
      acceptTerms: data.get("acceptTerms") === "on",
    })

    if (response.error) {
      setError(response.error)
      setLoading(false)
      return
    }

    clearCart()
    if (response.paymentUrl) {
      window.location.assign(response.paymentUrl)
      return
    }

    setResult({
      orderNumber: response.orderNumber || response.orderId || "",
      warning: response.warning,
      paymentPendingSetup: response.paymentPendingSetup,
    })
    setLoading(false)
  }

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5">
        <div className="w-full max-w-xl rounded-[32px] bg-white p-8 text-center shadow-[0_24px_80px_rgba(45,27,17,0.1)] sm:p-12">
          <CheckCircle2 className="mx-auto h-16 w-16 text-[#5b328a]" />
          <h1 className="mt-6 text-3xl font-black tracking-tight">Заказ {result.orderNumber} принят</h1>
          <p className="mt-3 text-sm leading-6 text-[#756b63]">Мы отправили подтверждение на указанную почту и свяжемся с вами для уточнения доставки.</p>
          {result.paymentPendingSetup && <div className="mt-6 rounded-2xl bg-[#fff4e8] p-4 text-sm text-[#8a4b1c]">Эквайринг работает в режиме подготовки. Платёжная ссылка появится после подключения реквизитов YooKassa.</div>}
          {result.warning && <div className="mt-4 rounded-2xl bg-[#fff4e8] p-4 text-sm text-[#8a4b1c]">{result.warning}</div>}
          <Link href="/shop" className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[#5b328a] px-6 text-sm font-bold text-white">Вернуться в каталог</Link>
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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e6610d]">Оформление без регистрации</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Куда доставить заказ?</h1>

            {error && <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-xs font-bold text-[#655c55]">ФИО</span><input name="fullName" required autoComplete="name" defaultValue={defaultName} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" placeholder="Иванов Иван Иванович" /></label>
              <label><span className="mb-2 block text-xs font-bold text-[#655c55]">Телефон</span><PhoneInput name="phone" required defaultValue={defaultPhone} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" /></label>
              <label><span className="mb-2 block text-xs font-bold text-[#655c55]">Email</span><input name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" placeholder="mail@example.ru" /></label>
            </div>

            <fieldset className="mt-8"><legend className="text-sm font-black">Способ получения</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{([['cdek','СДЭК'],['sochi_delivery','По Сочи'],['self_pickup','Самовывоз']] as [DeliveryMethod,string][]).map(([value,label]) => <button key={value} type="button" onClick={() => setDeliveryMethod(value)} className={`rounded-2xl border px-4 py-4 text-sm font-bold ${deliveryMethod === value ? "border-[#5b328a] bg-[#f4edfa] text-[#5b328a]" : "border-black/10"}`}>{label}</button>)}</div></fieldset>

            {deliveryMethod !== "self_pickup" && <label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Адрес доставки</span><input name="address" required autoComplete="street-address" defaultValue={defaultAddress} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" placeholder="Город, улица, дом, квартира" /></label>}
            <label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Комментарий</span><textarea name="comment" rows={3} className="w-full rounded-2xl border border-black/10 p-4 outline-none focus:border-[#5b328a]" placeholder="Пожелания к заказу" /></label>
            <label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Промокод</span><input name="promoCode" className="h-12 w-full rounded-2xl border border-black/10 px-4 uppercase outline-none focus:border-[#5b328a]" placeholder="Необязательно" /></label>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f8f5f1] p-4"><input name="createAccount" type="checkbox" className="mt-1 h-4 w-4 accent-[#5b328a]" /><span><b className="block text-sm">Создать личный кабинет</b><span className="mt-1 block text-xs leading-5 text-[#7d736b]">Необязательно. Пароль будет отправлен на email, а заказ появится в истории.</span></span></label>

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
            <button disabled={loading || !hydrated} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#5b328a] text-sm font-black text-white hover:bg-[#47256e] disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Оформляем…" : `Оформить заказ · ${formatPrice(subtotal)}`}</button>
          </form>

          <aside className="h-fit rounded-[32px] bg-[#1d1d1b] p-6 text-white lg:sticky lg:top-8">
            <h2 className="text-xl font-black">Ваш заказ</h2>
            <div className="mt-5 space-y-4">{lines.map(({ item, product, variant }) => <div key={item.id} className="flex gap-3 border-b border-white/10 pb-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product?.name}</p><p className="mt-1 text-xs text-white/50">{variant?.name} · {item.quantity} шт.</p></div><b className="text-sm">{formatPrice((variant?.price || 0) * item.quantity)}</b></div>)}</div>
            <div className="mt-6 flex items-end justify-between"><span className="text-sm text-white/55">Товары</span><strong className="text-2xl">{formatPrice(subtotal)}</strong></div>
          </aside>
        </div>
      </div>
    </main>
  )
}
