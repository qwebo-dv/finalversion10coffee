import Link from "next/link"
import Image from "next/image"

export const dynamic = "force-dynamic"

import { getClientOrders } from "@/lib/actions/orders"
import { getClientCompanies } from "@/lib/actions/companies"
import { getNewsPaginated } from "@/lib/actions/news"
import { getFavoriteProductIds, getMyReviews, getProductsForPreferences } from "@/lib/actions/products"
import { getCurrentUser } from "@/lib/actions/auth"
import { calculateCustomerPreferences, type CustomerPreferences } from "@/lib/customer-preferences"
import { CoffeeAcidity } from "@/components/shop/coffee-acidity"
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants"
import { formatPrice, formatDate, formatOrderNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import {
  ArrowUpRight,
  CalendarDays,
  Coffee,
  Heart,
  MessageSquare,
  Package,
  ReceiptText,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react"
import type { News, OrderStatus } from "@/types"

const STATUS_DOTS: Record<OrderStatus, string> = {
  new: "bg-amber-400",
  confirmed: "bg-sky-400",
  invoiced: "bg-indigo-400",
  paid: "bg-emerald-400",
  in_production: "bg-orange-400",
  ready: "bg-teal-400",
  shipped: "bg-violet-400",
  delivered: "bg-green-500",
  returned: "bg-red-400",
  cancelled: "bg-neutral-300",
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
  tone?: "cream" | "purple"
  href?: string
  className?: string
}

function StatCard({ label, value, sub, icon: Icon, tone = "cream", href, className }: StatCardProps) {
  const card = (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl p-4 sm:p-5",
        tone === "purple" ? "bg-[#5b328a] text-white" : "bg-[#f8f5f1] text-neutral-900"
      )}
    >
      {tone === "purple" && (
        <>
          <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/5" />
          <div className="absolute -bottom-14 -right-4 h-32 w-32 rounded-full bg-white/5" />
        </>
      )}
      <div className="relative flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.18em]",
            tone === "purple" ? "text-white/60" : "text-neutral-400"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            tone === "purple" ? "bg-white/15" : "bg-[#faead5]"
          )}
        >
          <Icon className={cn("h-4 w-4", tone === "purple" ? "text-white/80" : "text-[#e6610d]")} />
        </span>
      </div>
      <div className="relative mt-auto pt-3">
        <p
          className={cn(
            "text-[22px] sm:text-[26px] font-black tracking-tight tabular-nums leading-none",
            tone === "purple" ? "text-white" : "text-neutral-900"
          )}
        >
          {value}
        </p>
        {sub && (
          <p className={cn("mt-1.5 text-[11px] font-medium", tone === "purple" ? "text-white/55" : "text-neutral-400")}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className={cn("group block h-full min-w-0", className)}>
        {card}
      </Link>
    )
  }
  return <div className={cn("h-full min-w-0", className)}>{card}</div>
}

function PreferenceCard({ preferences }: { preferences: CustomerPreferences | null }) {
  const details = [
    { label: "Страна", value: preferences?.country },
    { label: "Обработка", value: preferences?.processingMethod },
    { label: "Регион", value: preferences?.region },
  ]

  return (
    <div className="relative col-span-2 min-h-[250px] overflow-hidden rounded-2xl bg-[#5b328a] p-5 text-white lg:row-span-2 sm:p-6">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-14 right-8 h-36 w-36 rounded-full bg-white/5" />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Мои предпочтения</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
          <Coffee className="h-4 w-4 text-white/80" />
        </span>
      </div>

      {preferences ? (
        <div className="relative mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Любимая группа</p>
          <p className="mt-1 text-3xl font-black tracking-tight">{preferences.favoriteGroup}</p>
          <p className="mt-1 text-[11px] text-white/50">по истории оплаченных покупок</p>

          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-white/10 pt-5">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">Средняя кислотность</p>
              {preferences.averageAcidity !== null ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black tabular-nums">{preferences.averageAcidity.toLocaleString("ru-RU")}</span>
                  <CoffeeAcidity value={preferences.averageAcidity} compact tone="inverse" showLabel={false} />
                </div>
              ) : <p className="mt-1 text-sm font-bold text-white/55">Недостаточно данных</p>}
            </div>
            {details.map((detail) => (
              <div key={detail.label}>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">{detail.label}</p>
                <p className="mt-1 line-clamp-2 text-sm font-bold leading-tight text-white/90">{detail.value || "Недостаточно данных"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative flex h-[180px] max-w-md flex-col justify-end">
          <p className="text-2xl font-black tracking-tight">Здесь появится ваш профиль вкуса</p>
          <p className="mt-2 text-sm leading-6 text-white/60">После первых оплаченных покупок мы определим любимую группу, кислотность, страну, обработку и регион.</p>
        </div>
      )}
    </div>
  )
}

export async function DashboardPage({ forceIndividual = false }: { forceIndividual?: boolean } = {}) {
  const currentUser = await getCurrentUser(forceIndividual ? "individual" : "business")
  const isIndividual = forceIndividual || currentUser?.user_metadata?.customer_type === "individual"

  const [orders, companies, newsResult] = await Promise.all([
    getClientOrders(),
    isIndividual ? Promise.resolve([]) : getClientCompanies().catch((error) => {
      console.error("[dashboard] Не удалось загрузить компании", error)
      return []
    }),
    getNewsPaginated(0, 3),
  ])

  const orderItems = orders.flatMap((order) => order.items || [])
  const [favoriteIds, myReviews, preferenceProducts] = isIndividual
    ? await Promise.all([
        getFavoriteProductIds(),
        getMyReviews(),
        getProductsForPreferences(
          orderItems.map((item) => item.product_id).filter(Boolean),
          orderItems.map((item) => item.product_name).filter(Boolean)
        ),
      ])
    : [null, null, []]
  const preferences = isIndividual ? calculateCustomerPreferences(orders, preferenceProducts) : null

  const recentOrders = orders.slice(0, 5)
  const news = (newsResult.items as News[]) || []

  // ── Stats (individuals) ──
  const settledOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned")
  const activeOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length

  const totalSpent = settledOrders.reduce((s, o) => s + o.total, 0)
  const totalItems = settledOrders.reduce(
    (s, o) => s + (o.items?.reduce((a, i) => a + i.quantity, 0) ?? 0),
    0
  )
  const avgCheck = settledOrders.length > 0 ? Math.round(totalSpent / settledOrders.length) : 0

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const dayOfWeek = now.getDay()
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
  )
  weekStart.setHours(0, 0, 0, 0)

  const weekOrders = orders.filter(
    (o) => o.status !== "cancelled" && new Date(o.created_at) >= weekStart
  )
  const monthOrders = orders.filter(
    (o) => o.status !== "cancelled" && new Date(o.created_at) >= monthStart
  )
  const weekSpent = weekOrders.reduce((s, o) => s + o.total, 0)
  const monthSpent = monthOrders.reduce((s, o) => s + o.total, 0)

  const favoritesCount = favoriteIds?.length ?? 0
  const reviewsCount = myReviews?.length ?? 0
  const cabinetPaths = isIndividual
    ? { orders: "/main/orders", favorites: "/main/favorites", reviews: "/main/reviews" }
    : { orders: "/dashboard/orders", favorites: "/dashboard/favorites", reviews: "/dashboard/reviews" }

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium text-neutral-300 tracking-[0.25em] uppercase">
            {today}
          </p>
          <h1 className="text-[22px] sm:text-[28px] font-black text-neutral-900 tracking-tight leading-none mt-1">
            {isIndividual ? "Статистика" : "Обзор"}
          </h1>
          {isIndividual && (
            <p className="text-[12px] text-neutral-400 mt-1.5">
              Статистика заказов в 10coffee
            </p>
          )}
        </div>
        {!isIndividual && (activeOrders > 0 || companies.length > 0) && (
          <p className="text-[12px] text-neutral-400 pb-0.5 shrink-0">
            {activeOrders > 0 && (
              <span>
                <span className="font-bold text-neutral-900 tabular-nums">{activeOrders}</span> активн.
              </span>
            )}
            {activeOrders > 0 && companies.length > 0 && <span className="mx-2 text-neutral-200">·</span>}
            {companies.length > 0 && (
              <span>
                <span className="font-bold text-neutral-900 tabular-nums">{companies.length}</span> комп.
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── Stats grid (individuals) ── */}
      {isIndividual && (
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <PreferenceCard preferences={preferences} />

            <StatCard
              label="Заказано товаров"
              value={totalItems.toLocaleString("ru-RU")}
              sub={`${plural(totalItems, "позиция", "позиции", "позиций")} в заказах`}
              icon={Package}
              href={cabinetPaths.orders}
            />

            <StatCard
              label="Любимые товары"
              value={favoritesCount.toLocaleString("ru-RU")}
              sub={favoritesCount > 0 ? "в вашем избранном" : "пока пусто"}
              icon={Heart}
              href={cabinetPaths.favorites}
            />

            <StatCard
              label="Заказов за неделю"
              value={weekOrders.length.toLocaleString("ru-RU")}
              sub={`на ${formatPrice(weekSpent)}`}
              icon={CalendarDays}
              href={cabinetPaths.orders}
            />

            <StatCard
              label="Заказов за месяц"
              value={monthOrders.length.toLocaleString("ru-RU")}
              sub={`на ${formatPrice(monthSpent)}`}
              icon={CalendarDays}
              href={cabinetPaths.orders}
            />

            <StatCard
              label="Активные заказы"
              value={activeOrders.toLocaleString("ru-RU")}
              sub={activeOrders > 0 ? "в работе" : "сейчас нет"}
              icon={ShoppingBag}
              href={cabinetPaths.orders}
            />

            <StatCard
              label="Отзывов оставлено"
              value={reviewsCount.toLocaleString("ru-RU")}
              sub={reviewsCount > 0 ? "благодарим за обратную связь" : "ещё нет отзывов"}
              icon={MessageSquare}
              href={cabinetPaths.reviews}
            />

            <StatCard
              label="Средний чек"
              value={formatPrice(avgCheck)}
              sub={avgCheck > 0 ? "по всем заказам" : "после первого заказа"}
              icon={ReceiptText}
              href={cabinetPaths.orders}
              className="col-span-2"
            />
          </div>
        </section>
      )}

      {/* ── Orders ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] uppercase">
            Последние заказы
          </h2>
          {orders.length > 0 && (
            <Link
              href={cabinetPaths.orders}
              className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1 group"
            >
              Все
              <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/[0.04] px-6 py-10 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[#faead5] flex items-center justify-center mx-auto mb-4">
              <Coffee className="h-6 w-6 text-[#5b328a]/40" />
            </div>
            <p className="text-[14px] font-bold text-neutral-900">Нет заказов</p>
            <p className="text-[12px] text-neutral-400 mt-1">
              {isIndividual
                ? "Оформите первый заказ в интернет-магазине"
                : "Оформите первый заказ в каталоге"}
            </p>
            <Link
              href={isIndividual ? "/shop" : "/dashboard/catalog"}
              className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-bold text-[#5b328a] hover:text-[#4a2870] transition-colors"
            >
              {isIndividual ? "Перейти в магазин" : "Перейти в каталог"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const itemsSummary = order.items
                ?.slice(0, 3)
                .map((item) => `${item.product_name} ×${item.quantity}`)
                .join(", ")
              const moreCount = (order.items?.length || 0) - 3

              return (
                <Link
                  key={order.id}
                  href={cabinetPaths.orders}
                  className="block bg-white rounded-xl border border-black/[0.04] px-4 sm:px-5 py-3 sm:py-4 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[14px] font-black text-neutral-900 tabular-nums">
                          {formatOrderNumber(order.order_id)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[order.status])} />
                          <span className="text-[11px] font-medium text-neutral-400">
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                        </div>
                      </div>
                      <p className="text-[12px] text-neutral-400 mt-1.5 truncate">
                        {itemsSummary}
                        {moreCount > 0 && ` +${moreCount}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[16px] font-black text-neutral-900 tabular-nums">
                        {formatPrice(order.total)}
                      </p>
                      <p className="text-[10px] text-neutral-300 mt-1">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── News (legal entities) ── */}
      {!isIndividual && news.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] uppercase">Новости</h2>
            <Link
              href="/dashboard/news"
              className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1"
            >
              Все
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {news.slice(0, 2).map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/news/${item.id}`}
                className="flex gap-4 bg-white rounded-xl border border-black/[0.04] p-4 hover:shadow-sm transition-all group"
              >
                {item.cover_image && (
                  <div className="relative h-16 w-20 rounded-lg bg-neutral-100 shrink-0 overflow-hidden">
                    <Image src={item.cover_image} alt="" fill sizes="80px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-neutral-900 line-clamp-1 group-hover:text-[#5b328a] transition-colors">
                    {item.title}
                  </p>
                  {item.excerpt && (
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.excerpt}
                    </p>
                  )}
                  {item.published_at && (
                    <p className="text-[10px] text-neutral-300 mt-1.5">{formatDate(item.published_at)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Companies (legal entities) ── */}
      {!isIndividual && companies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] uppercase">Компании</h2>
            <Link
              href="/dashboard/companies"
              className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1"
            >
              Управление
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {companies.slice(0, 4).map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-xl border border-black/[0.04] px-4 py-3.5 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-black text-neutral-400">
                    {company.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-neutral-900 truncate">{company.name}</p>
                  <p className="text-[10px] text-neutral-400 tabular-nums">ИНН {company.inn}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default DashboardPage
