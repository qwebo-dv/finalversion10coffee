"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { useCart } from "@/providers/cart-provider"
import { useNotifications } from "@/providers/notification-provider"
import { signOut } from "@/lib/actions/auth"
import { getFavoriteProducts, getClientDiscountConfig } from "@/lib/actions/products"
import { CartSidebar } from "./cart-sidebar"
import {
  LogOut,
  Coffee,
  Settings,
  Heart,
  Bell,
  X,
  ShoppingBag,
  Newspaper,
  BookOpen,
  Package,
  CheckCheck,
  Building2,
  FileText,
  Send,
  GraduationCap,
  Globe,
  Trash2,
} from "lucide-react"
import { getSiteSettings } from "@/lib/actions/site-settings"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useState, useEffect, useCallback, useRef } from "react"
import { formatDateTime } from "@/lib/utils/format"
import type { CategoryDiscountRule, ProductDiscountRule } from "@/lib/discounts"
import type { Product, NotificationType } from "@/types"

type SlidePanel = "favorites" | "notifications" | "cart" | null

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { items, updateQuantity, removeItem, clearCart } = useCart()
  const { notifications, unreadCount, markAsRead, markAllAsRead, hasNewNotification } = useNotifications()

  const isIndividual = user?.user_metadata?.customer_type === "individual"

  const RETAIL_FORBIDDEN_PREFIXES = [
    "/dashboard/catalog",
    "/dashboard/product",
    "/dashboard/favorites",
    "/dashboard/news",
    "/dashboard/blog",
    "/dashboard/checkout",
    "/dashboard/companies",
  ]
  const isForbiddenRetailPath =
    isIndividual &&
    RETAIL_FORBIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))

  useEffect(() => {
    if (isForbiddenRetailPath) router.replace("/dashboard")
  }, [isForbiddenRetailPath, router])

  // Badge disappear animation
  const [badgeVisible, setBadgeVisible] = useState(unreadCount > 0)
  const [badgeAnimatingOut, setBadgeAnimatingOut] = useState(false)
  const prevUnreadCount = useRef(unreadCount)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (unreadCount > 0) {
        setBadgeVisible(true)
        setBadgeAnimatingOut(false)
      } else if (prevUnreadCount.current > 0 && unreadCount === 0) {
        setBadgeAnimatingOut(true)
        window.setTimeout(() => {
          setBadgeVisible(false)
          setBadgeAnimatingOut(false)
        }, 300)
      }
      prevUnreadCount.current = unreadCount
    }, 0)

    return () => window.clearTimeout(timer)
  }, [unreadCount])
  const [activePanel, setActivePanel] = useState<SlidePanel>(null)
  const [favorites, setFavorites] = useState<Product[]>([])
  const [favsLoading, setFavsLoading] = useState(false)
  const [priceListUrl, setPriceListUrl] = useState("")
  const [clientDiscount, setClientDiscount] = useState(0)
  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscountRule[]>([])
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountRule[]>([])

  useEffect(() => {
    getSiteSettings().then((s) => {
      if (s?.priceListUrl) setPriceListUrl(s.priceListUrl)
    })
    getClientDiscountConfig().then((config) => {
      setClientDiscount(config.discountPercent)
      setCategoryDiscounts(config.categoryDiscounts)
      setProductDiscounts(config.productDiscounts || [])
    })
  }, [])

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || ""
  const avatarUrl: string | null = user?.user_metadata?.avatar_url || null

  const isCatalog = pathname.startsWith("/dashboard/catalog") || pathname.startsWith("/dashboard/product") || pathname === "/dashboard/favorites"
  const isDashboard = !isCatalog

  const loadFavorites = useCallback(async () => {
    setFavsLoading(true)
    const data = await getFavoriteProducts()
    setFavorites(data)
    setFavsLoading(false)
  }, [])

  function togglePanel(panel: SlidePanel) {
    if (activePanel === panel) {
      setActivePanel(null)
    } else {
      setActivePanel(panel)
      if (panel === "favorites") loadFavorites()
    }
  }

  return (
    <div className="min-h-screen bg-white p-2 md:p-3">
      <div className="bg-white rounded-[22px] h-[calc(100vh-1.5rem)] overflow-hidden shadow-sm flex flex-col relative mx-auto max-w-[1240px]">

        {/* ── TOP NAV BAR ── */}
        <header className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-5 shrink-0 z-30 relative">
          {/* Left: Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <img src="/Основной (упрощенный).svg" alt="10кофе" className="w-[130px] sm:w-[120px] h-[55px] object-contain" />
          </Link>

          {/* Center: Tab Switcher — desktop only */}
          <div className="hidden lg:flex items-center bg-[#5b328a] rounded-full p-1 gap-0.5">
            <Link
              href="/dashboard"
              className={cn(
                "px-5 py-2 rounded-full text-[13px] font-semibold transition-all duration-300",
                isDashboard
                  ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              Кабинет
            </Link>
            <Link
              href={isIndividual ? "/shop" : "/dashboard/catalog"}
              className={cn(
                "px-5 py-2 rounded-full text-[13px] font-semibold transition-all duration-300",
                isIndividual
                  ? "text-white/40 hover:text-white/70"
                  : isCatalog
                    ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
                    : "text-white/40 hover:text-white/70"
              )}
            >
              {isIndividual ? "Интернет-магазин" : "Каталог"}
            </Link>
          </div>

          {/* Right: Icons + User */}
          <div className="flex items-center gap-1">
            {/* Favorites */}
            {!isIndividual && (
              <button
                onClick={() => togglePanel("favorites")}
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
                  activePanel === "favorites"
                    ? "bg-[#faead5] text-[#e6610d]"
                    : "text-neutral-400 hover:text-[#e6610d] hover:bg-[#faead5]/50"
                )}
              >
                <Heart className={cn("h-[18px] w-[18px]", activePanel === "favorites" && "fill-[#e6610d]")} />
              </button>
            )}

            {/* Notifications */}
            {!isIndividual && (
              <button
                onClick={() => togglePanel("notifications")}
                className={cn(
                  "relative h-9 w-9 rounded-xl flex items-center justify-center transition-all",
                  activePanel === "notifications"
                    ? "bg-[#faead5] text-[#5b328a]"
                    : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                )}
              >
                <Bell className={cn("h-[18px] w-[18px]", hasNewNotification && "animate-bell-ring")} />
                {badgeVisible && (
                  <span
                    className={cn(
                      "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e6610d] text-white text-[9px] font-bold px-0.5 transition-all duration-300",
                      badgeAnimatingOut ? "opacity-0 scale-0" : "opacity-100 scale-100"
                    )}
                  >
                    {unreadCount || 1}
                  </span>
                )}
              </button>
            )}

            <div className="w-px h-6 bg-neutral-200 mx-1.5" />

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full hover:bg-black/[0.04] pl-2 pr-1 py-1 transition-colors">
                  <span className="text-[13px] font-medium text-neutral-600 hidden sm:block">{displayName}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6610d] text-white text-[11px] font-bold overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-neutral-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-[#e6610d] focus:text-[#e6610d] cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">

          {/* Left sidebar - Cabinet navigation */}
          {isDashboard && (
            <aside className="w-[210px] shrink-0 hidden lg:flex flex-col pt-4 pb-6 pl-5 pr-2 overflow-y-auto">
              <nav className="space-y-0.5">
                {(
                  isIndividual
                    ? [
                        { href: "/dashboard/orders", label: "Заказы", icon: Package },
                        { href: "/dashboard/settings", label: "Настройки", icon: Settings },
                      ]
                    : [
                        { href: "/dashboard/orders", label: "Заказы", icon: Package },
                        { href: "/dashboard/companies", label: "Компании", icon: Building2 },
                        { href: "/dashboard/news", label: "Новости", icon: Newspaper },
                        { href: "/dashboard/blog", label: "Блог", icon: BookOpen },
                        { href: "/dashboard/settings", label: "Настройки", icon: Settings },
                      ]
                ).map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                        active
                          ? "bg-white text-neutral-900 font-semibold shadow-sm"
                          : "text-neutral-500 hover:text-neutral-900 hover:bg-white/60"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#5b328a]" : "text-neutral-300")} />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <div className="h-px bg-neutral-200/50 my-4 mx-1" />

              {isIndividual ? (
                <div className="space-y-0.5">
                  <Link
                    href="/shop"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-neutral-500 hover:text-neutral-900 hover:bg-white/60 transition-all"
                  >
                    <ShoppingBag className="h-4 w-4 text-neutral-300 shrink-0" />
                    Интернет-магазин
                  </Link>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <a
                    href="/obuchenie"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-neutral-500 hover:text-neutral-900 hover:bg-white/60 transition-all"
                  >
                    <GraduationCap className="h-4 w-4 text-neutral-300 shrink-0" />
                    Обучение
                  </a>
                  <a
                    href={priceListUrl || "/Прайс 10coffee_ Март 2026г. (1).pdf"}
                    download
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-neutral-500 hover:text-neutral-900 hover:bg-white/60 transition-all"
                  >
                    <FileText className="h-4 w-4 text-neutral-300 shrink-0" />
                    Прайс-лист
                  </a>
                  <a
                    href="tg://resolve?domain=local10coffee"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-neutral-500 hover:text-neutral-900 hover:bg-white/60 transition-all"
                  >
                    <Send className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                    Telegram-канал
                  </a>
                </div>
              )}

              <div className="h-px bg-neutral-200/50 my-4 mx-1" />

              <div className="space-y-0.5">
                <Link
                  href={isIndividual ? "/shop" : "/"}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-neutral-500 hover:text-neutral-900 hover:bg-white/60 transition-all"
                >
                  <Globe className="h-4 w-4 text-neutral-300 shrink-0" />
                  {isIndividual ? "Перейти в магазин" : "Оптовый сайт"}
                </Link>
              </div>
            </aside>
          )}

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="p-3 sm:p-5 md:p-6 pb-20 lg:pb-6">
              {isForbiddenRetailPath ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-[#faead5] flex items-center justify-center mb-4">
                    <ShoppingBag className="h-7 w-7 text-[#e6610d]/40" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">Раздел недоступен</p>
                  <p className="text-[12px] text-neutral-400 mt-1">Этот раздел доступен только оптовым клиентам</p>
                </div>
              ) : (
                children
              )}
            </div>
          </main>

          {/* Right sidebar - Cart */}
          {!isIndividual && (
            <CartSidebar
              items={items}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              onClearCart={clearCart}
              priceListUrl={priceListUrl}
              clientDiscount={clientDiscount}
              categoryDiscounts={categoryDiscounts}
              productDiscounts={productDiscounts}
            />
          )}

          {/* ── SLIDE-OVER PANEL ── */}
          {activePanel && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 sm:absolute bg-black/20 z-40 animate-fade-in"
                onClick={() => setActivePanel(null)}
              />

              {/* Panel */}
              <div className="fixed inset-0 sm:absolute sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto w-full sm:max-w-[520px] bg-white z-50 shadow-2xl shadow-black/20 animate-slide-in-right flex flex-col sm:rounded-l-2xl">
                {/* Panel header */}
                <div className="flex items-center justify-between px-6 h-16 border-b border-neutral-100 shrink-0">
                  <div className="flex items-center gap-3">
                    {activePanel === "cart" ? (
                      <>
                        <div className="h-9 w-9 rounded-xl bg-[#5b328a] flex items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h2 className="text-[15px] font-bold text-neutral-900">Корзина</h2>
                          <p className="text-[11px] text-neutral-400">
                            {items.length === 0 ? "Пусто" : `${items.length} товаров`}
                          </p>
                        </div>
                      </>
                    ) : activePanel === "favorites" ? (
                      <>
                        <div className="h-9 w-9 rounded-xl bg-[#faead5] flex items-center justify-center">
                          <Heart className="h-4 w-4 text-[#e6610d] fill-[#e6610d]" />
                        </div>
                        <h2 className="text-[15px] font-bold text-neutral-900">Избранное</h2>
                      </>
                    ) : (
                      <>
                        <div className="h-9 w-9 rounded-xl bg-[#faead5] flex items-center justify-center">
                          <Bell className="h-4 w-4 text-[#5b328a]" />
                        </div>
                        <div>
                          <h2 className="text-[15px] font-bold text-neutral-900">Уведомления</h2>
                          {unreadCount > 0 && (
                            <p className="text-[11px] text-neutral-400">{unreadCount} непрочитанных</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activePanel === "cart" && items.length > 0 && (
                      <button
                        onClick={clearCart}
                        className="h-9 w-9 rounded-xl flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Очистить корзину"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {activePanel === "notifications" && unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#5b328a] bg-[#faead5] hover:bg-[#faead5]/80 transition-colors"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Прочитать все
                      </button>
                    )}
                    <button
                      onClick={() => setActivePanel(null)}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Panel body */}
                <div className="flex flex-col flex-1 min-h-0">
                  {activePanel === "cart" ? (
                    <CartSidebar
                      items={items}
                      onUpdateQuantity={updateQuantity}
                      onRemoveItem={removeItem}
                      onClearCart={clearCart}
                      onClose={() => setActivePanel(null)}
                      inPanel
                      priceListUrl={priceListUrl}
                      clientDiscount={clientDiscount}
                      categoryDiscounts={categoryDiscounts}
                      productDiscounts={productDiscounts}
                    />
                  ) : activePanel === "favorites" ? (
                    <FavoritesContent favorites={favorites} loading={favsLoading} onClose={() => setActivePanel(null)} />
                  ) : (
                    <NotificationsContent notifications={notifications} markAsRead={markAsRead} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-100 px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around h-14">
            <Link
              href="/dashboard"
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                pathname === "/dashboard" ? "text-[#5b328a]" : "text-neutral-400"
              )}
            >
              <Package className="h-5 w-5" />
              <span className="text-[10px] font-medium">Заказы</span>
            </Link>
            {isIndividual ? (
              <Link
                href="/shop"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                  pathname.startsWith("/shop") ? "text-[#5b328a]" : "text-neutral-400"
                )}
              >
                <ShoppingBag className="h-5 w-5" />
                <span className="text-[10px] font-medium">Магазин</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/catalog"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                  isCatalog ? "text-[#5b328a]" : "text-neutral-400"
                )}
              >
                <Coffee className="h-5 w-5" />
                <span className="text-[10px] font-medium">Каталог</span>
              </Link>
            )}
            {!isIndividual && (
              <button
                onClick={() => togglePanel("cart")}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                  activePanel === "cart" ? "text-[#5b328a]" : "text-neutral-400"
                )}
              >
                <ShoppingBag className="h-5 w-5" />
                {items.length > 0 && (
                  <span className="absolute top-0.5 right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-[#e6610d] text-white text-[9px] font-bold flex items-center justify-center">
                    {items.length}
                  </span>
                )}
                <span className="text-[10px] font-medium">Корзина</span>
              </button>
            )}
            {!isIndividual && (
              <Link
                href="/dashboard/companies"
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                  pathname.startsWith("/dashboard/companies") ? "text-[#5b328a]" : "text-neutral-400"
                )}
              >
                <Building2 className="h-5 w-5" />
                <span className="text-[10px] font-medium">Компании</span>
              </Link>
            )}
            <Link
              href="/dashboard/settings"
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors",
                pathname === "/dashboard/settings" ? "text-[#5b328a]" : "text-neutral-400"
              )}
            >
              <Settings className="h-5 w-5" />
              <span className="text-[10px] font-medium">Настройки</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}

// ── Favorites Panel Content ──
function FavoritesContent({ favorites, loading, onClose }: { favorites: Product[]; loading: boolean; onClose: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[#faead5] border-t-[#5b328a] animate-spin" />
      </div>
    )
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-[#faead5] flex items-center justify-center mb-4">
          <Heart className="h-7 w-7 text-[#e6610d]/40" />
        </div>
        <p className="text-sm font-semibold text-neutral-900">Нет избранных</p>
        <p className="text-[12px] text-neutral-400 mt-1">Нажмите на сердечко, чтобы сохранить товар</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {favorites.map((product) => {
        const imageUrl = product.images?.[0] || null
        return (
          <Link
            key={product.id}
            href={`/dashboard/product/${product.id}`}
            onClick={onClose}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-50 transition-colors group"
          >
            <div className="relative h-14 w-14 rounded-xl bg-[#faead5] flex items-center justify-center shrink-0 overflow-hidden">
              {imageUrl ? (
                <Image src={imageUrl} alt={product.name} fill sizes="56px" className="object-cover" />
              ) : (
                <Coffee className="h-5 w-5 text-[#e6610d]/30" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-neutral-900 group-hover:text-[#5b328a] transition-colors">{product.name}</p>
              {product.region && (
                <p className="text-[11px] text-neutral-400 mt-0.5">{product.region}</p>
              )}
              {product.variants?.[0] && (
                <p className="text-[12px] font-semibold text-neutral-600 mt-1">
                  от {Math.round(product.variants[0].price).toLocaleString("ru-RU")} ₽
                </p>
              )}
            </div>
            <Heart className="h-4 w-4 fill-[#e6610d] text-[#e6610d] shrink-0" />
          </Link>
        )
      })}
    </div>
  )
}

// ── Notifications Panel Content ──
const notifIcons: Record<NotificationType, typeof Bell> = {
  order_update: ShoppingBag,
  news: Newspaper,
  product_restock: Package,
}

const notifColors: Record<NotificationType, string> = {
  order_update: "bg-[#faead5] text-[#e6610d]",
  news: "bg-[#faead5] text-[#5b328a]",
  product_restock: "bg-[#faead5] text-[#5b328a]",
}

function NotificationsContent({
  notifications,
  markAsRead,
}: {
  notifications: Array<{ id: string; type: NotificationType; title: string; message: string; is_read: boolean; created_at: string }>
  markAsRead: (id: string) => Promise<void>
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
          <Bell className="h-7 w-7 text-violet-200" />
        </div>
        <p className="text-sm font-semibold text-neutral-900">Нет уведомлений</p>
        <p className="text-[12px] text-neutral-400 mt-1">Уведомления о заказах появятся здесь</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {notifications.map((n) => {
        const Icon = notifIcons[n.type] || Bell
        const colorClass = notifColors[n.type] || "bg-neutral-50 text-neutral-600"
        return (
          <div
            key={n.id}
            onClick={() => !n.is_read && markAsRead(n.id)}
            className={cn(
              "flex gap-3 p-4 rounded-xl transition-colors cursor-pointer",
              !n.is_read ? "bg-violet-50/50 hover:bg-violet-50" : "hover:bg-neutral-50"
            )}
          >
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", colorClass)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-neutral-900">{n.title}</span>
                {!n.is_read && <div className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />}
              </div>
              <p className="text-[12px] text-neutral-500 mt-0.5 leading-relaxed">{n.message}</p>
              <p className="text-[11px] text-neutral-400 mt-1">{formatDateTime(n.created_at)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
