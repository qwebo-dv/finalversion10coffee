"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpRight, ChevronDown, ChevronRight, Menu, Minus, Plus, Search, ShoppingBag, User, X } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { useAuth } from "@/providers/auth-provider"
import { NotificationMenu } from "@/components/shop/notification-menu"
import { openAuthModal } from "@/components/auth/auth-modal-store"
import { PendingPaymentCard } from "@/components/shop/pending-payment-card"
import { formatPrice } from "@/lib/utils/format"
import { formatProductCount } from "@/lib/utils/plural"
import type { Product, ProductTypeOption } from "@/types"

const FALLBACK_TYPES = [
  { slug: "kofe", name: "Кофе" },
  { slug: "chay", name: "Чай" },
  { slug: "aksessuary", name: "Аксессуары" },
]

const NAV_LINKS = [
  { label: "Контакты", href: "/contacts" },
  { label: "Доставка и оплата", href: "/delivery" },
  { label: "Возврат", href: "/return" },
  { label: "Вопросы и ответы", href: "/faq" },
]

const COMPANY_LINKS = [
  { label: "О нас", href: "/o-nas" },
  { label: "Новости", href: "/news" },
  { label: "Блог", href: "/blog" },
  { label: "Контакты", href: "/kontakty" },
]

export function ShopHeader({ products, productTypes }: { products: Product[]; productTypes?: ProductTypeOption[] }) {
  const router = useRouter()
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { items, hydrated, updateQuantity, removeItem, removeItems, clearCart, pendingPayment } = useGuestCart()
  const { user } = useAuth()
  // The shop layout has its own individual session cookie. OAuth can restore
  // a pre-existing client whose legacy metadata has no customer_type, so the
  // active session—not that optional metadata—must control the header state.
  const individualUser = Boolean(user)

  const avatarUrl: string | null = individualUser ? user?.user_metadata?.avatar_url || null : null
  const displayName = individualUser ? user?.user_metadata?.full_name || user?.email || "" : ""
  const initial = displayName.trim()[0]?.toUpperCase() || "U"

  const cartLines = items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    return { item, product, variant }
  }).filter((line) => line.product && line.variant)
  const itemCount = cartLines.reduce((sum, line) => sum + line.item.quantity, 0)
  const unavailableItemIds = useMemo(() => items.filter((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    return !product?.variants?.some((entry) => entry.id === item.variantId)
  }).map((item) => item.id), [items, products])

  useEffect(() => {
    if (hydrated && unavailableItemIds.length > 0) removeItems(unavailableItemIds)
  }, [hydrated, removeItems, unavailableItemIds])
  const cartTotal = cartLines.reduce((sum, line) => sum + (line.variant?.price || 0) * line.item.quantity, 0)

  const typeLinks = productTypes && productTypes.length > 0
    ? productTypes.filter((type) => type.slug !== "sluzhebnoe" && type.slug !== "oprihodovanie-i-to").map((type) => ({ slug: type.slug, name: type.name }))
    : FALLBACK_TYPES

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMenuOpen(false)
    const search = `?q=${encodeURIComponent(query.trim())}`
    router.push(`/shop${search}`)
  }

  function isLocalShop() {
    return window.location.hostname === "localhost" || window.location.hostname.endsWith(".localhost")
  }

  function keepLocalShopRoute(event: React.MouseEvent<HTMLAnchorElement>, search = "") {
    if (!isLocalShop()) return
    event.preventDefault()
    router.push(`/shop${search}`)
  }

  function openAuth(view: "login" | "register") {
    setMenuOpen(false)
    openAuthModal(view)
  }

  return (
    <>
      {/* Utility bar */}
      <div className="bg-[#1d1d1b] text-white">
        <div className="mx-auto flex h-11 max-w-[1480px] items-center justify-between gap-4 px-5 text-xs font-semibold tracking-wide lg:px-10">
          <p className="truncate text-[#cfc7bf]">Свежая обжарка · доставка по всей России</p>
          <div className="flex shrink-0 items-center gap-5">
            <a href="https://10coffee.ru" className="flex items-center gap-1 transition hover:text-[#e6610d]">Оптовый сайт <ArrowUpRight className="h-3 w-3" /></a>
            {individualUser ? (
              <div className="hidden md:flex"><NotificationMenu avatarUrl={avatarUrl} displayName={displayName} initial={initial} /></div>
            ) : (
              <button type="button" onClick={() => openAuth("login")} className="hidden items-center gap-1.5 transition hover:text-[#e6610d] lg:flex"><User className="h-3 w-3" /> Войти</button>
            )}
            {!individualUser && <button type="button" onClick={() => openAuth("register")} className="hidden rounded-full bg-[#e6610d] px-3 py-1 font-bold transition hover:bg-[#cf5206] lg:inline">Регистрация</button>}
          </div>
        </div>
      </div>

      {/* Main bar */}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f8f5f1]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-24 max-w-[1480px] items-center gap-6 px-5 lg:px-10">
          <button type="button" onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full text-[#1d1d1b] transition hover:bg-black/[0.05] lg:hidden"><Menu className="h-5 w-5" /></button>
          <Link href="/" onClick={keepLocalShopRoute} className="flex shrink-0 items-center"><img src="/logo.svg" alt="10COFFEE" className="h-12 w-auto" /></Link>

          {/* Desktop nav */}
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            <div className="group relative">
              <button type="button" className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-[#554b43] transition hover:bg-black/[0.05] hover:text-[#5b328a]">Купить <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" /></button>
              <div className="invisible absolute left-0 top-full z-50 w-60 translate-y-2 rounded-2xl border border-black/[0.06] bg-white p-2 opacity-0 shadow-[0_24px_70px_rgba(45,27,17,0.16)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {typeLinks.map((type) => <Link key={type.slug} href={`/${type.slug}`} className="block rounded-xl px-4 py-3 text-sm font-bold text-[#554b43] transition hover:bg-[#f8f5f1] hover:text-[#5b328a]">{type.name}</Link>)}
              </div>
            </div>
            <Link href="/news" className="rounded-full px-4 py-2.5 text-sm font-bold text-[#554b43] transition hover:bg-black/[0.05] hover:text-[#5b328a]">Новости</Link>
            <Link href="/blog" className="rounded-full px-4 py-2.5 text-sm font-bold text-[#554b43] transition hover:bg-black/[0.05] hover:text-[#5b328a]">Блог</Link>
            <div className="group relative">
              <button type="button" className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-[#554b43] transition hover:bg-black/[0.05] hover:text-[#5b328a]">Покупателю <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" /></button>
              <div className="invisible absolute left-0 top-full z-50 w-64 translate-y-2 rounded-2xl border border-black/[0.06] bg-white p-2 opacity-0 shadow-[0_24px_70px_rgba(45,27,17,0.16)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {NAV_LINKS.map((link) => <Link key={link.href} href={link.href} className="block rounded-xl px-4 py-3 text-sm font-bold text-[#554b43] transition hover:bg-[#f8f5f1] hover:text-[#5b328a]">{link.label}</Link>)}
              </div>
            </div>
          </nav>

          <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 items-center gap-3 rounded-full bg-white px-5 py-2.5 shadow-sm ring-1 ring-black/[0.06] transition focus-within:ring-2 focus-within:ring-[#5b328a]/40 lg:flex lg:w-[300px]">
            <Search className="h-4 w-4 shrink-0 text-[#8c8178]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по каталогу" className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa098]" />
          </form>

          <button type="button" onClick={() => setCartOpen(true)} className="relative ml-auto flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm font-bold text-white transition hover:bg-[#000] lg:ml-0">
            <ShoppingBag className="h-4 w-4" /> <span className="hidden sm:inline">Корзина</span>
            {itemCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e6610d] px-1 text-[10px]">{itemCount}</span>}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm lg:hidden" onMouseDown={() => setMenuOpen(false)}>
          <aside className="flex h-full w-full max-w-sm flex-col bg-[#f8f5f1] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center border-b border-black/[0.06] px-6 py-5">
              <Link href="/" onClick={(event) => { setMenuOpen(false); keepLocalShopRoute(event) }} className="flex shrink-0 items-center"><img src="/logo.svg" alt="10COFFEE" className="h-12 w-auto" /></Link>
              <button onClick={() => setMenuOpen(false)} className="ml-auto rounded-full p-2 hover:bg-black/[0.05]"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitSearch} className="flex items-center gap-3 px-6 pt-5"><div className="flex flex-1 items-center gap-3 rounded-full bg-white px-5 py-3 shadow-sm"><Search className="h-4 w-4 text-[#8c8178]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по каталогу" className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa098]" /></div><button type="submit" className="rounded-full bg-[#5b328a] px-5 py-3 text-sm font-bold text-white">Найти</button></form>
            <nav className="flex-1 space-y-1 overflow-y-auto px-6 py-5">
              <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#91867d]">Каталог</p>
              {typeLinks.map((type) => <Link key={type.slug} href={`/${type.slug}`} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-3 text-base font-bold text-[#1d1d1b] transition hover:bg-black/[0.04]">{type.name}</Link>)}
              <p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#91867d]">Покупателям</p>
              {NAV_LINKS.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-3 text-base font-bold text-[#1d1d1b] transition hover:bg-black/[0.04]">{link.label}</Link>)}
              <p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#91867d]">Компания</p>
              {COMPANY_LINKS.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-3 text-base font-bold text-[#1d1d1b] transition hover:bg-black/[0.04]">{link.label}</Link>)}
              <a href="https://10coffee.ru" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-bold text-[#e6610d]">Оптовый сайт <ArrowUpRight className="h-4 w-4" /></a>
              {individualUser ? (
                <Link href="/main" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-bold text-[#1d1d1b] transition hover:bg-black/[0.04]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e6610d] text-sm font-black text-white">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{displayName}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#c3b8af]" />
                </Link>
              ) : (
                <>
                  <button type="button" onClick={() => openAuth("login")} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-base font-bold text-[#1d1d1b] transition hover:bg-black/[0.04]">Войти в аккаунт<ChevronRight className="h-4 w-4 text-[#c3b8af]" /></button>
                  <button type="button" onClick={() => openAuth("register")} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-base font-bold text-[#1d1d1b] transition hover:bg-black/[0.04]">Регистрация<ChevronRight className="h-4 w-4 text-[#c3b8af]" /></button>
                </>
              )}
            </nav>
          </aside>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" onMouseDown={() => setCartOpen(false)}>
          <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center border-b border-black/[0.06] px-6 py-5"><div><h2 className="text-xl font-black">Корзина</h2><p className="text-xs text-[#8d827a]">{formatProductCount(itemCount)}</p></div><button onClick={() => setCartOpen(false)} className="ml-auto rounded-full p-2 hover:bg-[#f5f1ed]"><X className="h-5 w-5" /></button></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <PendingPaymentCard />
              {cartLines.length === 0 ? <p className="py-20 text-center text-sm text-[#8d827a]">Корзина пока пуста</p> : cartLines.map(({ item, product, variant }) => (
                <div key={item.id} className="rounded-2xl bg-[#f8f5f1] p-4">
                  <div className="flex gap-3"><div className="min-w-0 flex-1"><p className="truncate font-bold">{product?.name}</p><p className="text-xs text-[#887d75]">{variant?.name}{item.grindOption ? ` · ${item.grindOption}` : ""}</p></div><button onClick={() => removeItem(item.id)}><X className="h-4 w-4 text-[#a0948c]" /></button></div>
                  <div className="mt-4 flex items-center justify-between"><div className="flex items-center rounded-full bg-white"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2"><Minus className="h-3 w-3" /></button><span className="w-7 text-center text-xs font-bold">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2"><Plus className="h-3 w-3" /></button></div><b>{formatPrice((variant?.price || 0) * item.quantity)}</b></div>
                </div>
              ))}
            </div>
            <div className="border-t border-black/[0.06] p-6"><div className="mb-4 flex items-end justify-between"><span className="text-sm text-[#766d66]">Итого</span><strong className="text-2xl">{formatPrice(cartTotal)}</strong></div><Link href="/checkout" className={`flex h-14 items-center justify-center gap-2 rounded-full text-sm font-black ${cartLines.length && !pendingPayment ? "bg-[#5b328a] text-white" : "pointer-events-none bg-[#eee9e5] text-[#aaa098]"}`}>{pendingPayment ? "Сначала завершите текущий заказ" : "Оформить заказ"} <ChevronRight className="h-4 w-4" /></Link>{cartLines.length > 0 && <button onClick={clearCart} className="mt-3 w-full text-xs font-bold text-[#9b9087] hover:text-red-600">Очистить корзину</button>}</div>
          </aside>
        </div>
      )}
    </>
  )
}
