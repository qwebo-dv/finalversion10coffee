import Link from "next/link"
import Image from "next/image"

export const dynamic = "force-dynamic"

import { getClientOrders } from "@/lib/actions/orders"
import { getClientCompanies } from "@/lib/actions/companies"
import { getNewsPaginated } from "@/lib/actions/news"
import { getCurrentUser } from "@/lib/auth/local"
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants"
import { formatPrice, formatDate, formatOrderNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ArrowUpRight, Coffee } from "lucide-react"
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

export default async function DashboardPage() {
  const currentUser = await getCurrentUser()
  const isIndividual = currentUser?.user_metadata?.customer_type === "individual"

  const [orders, companies, newsResult] = await Promise.all([
    getClientOrders(),
    getClientCompanies(),
    getNewsPaginated(0, 3),
  ])

  const recentOrders = orders.slice(0, 6)
  const news = (newsResult.items as News[]) || []
  const activeOrders = orders.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  ).length

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Header ── */}
      <div>
        <p className="text-[10px] font-medium text-neutral-300 tracking-[0.25em] uppercase">
          {today}
        </p>
        <div className="flex items-end justify-between mt-1">
          <h1 className="text-[22px] sm:text-[28px] font-black text-neutral-900 tracking-tight leading-none">
            Обзор
          </h1>
          {(activeOrders > 0 || (!isIndividual && companies.length > 0)) && (
            <p className="text-[12px] text-neutral-400 pb-0.5">
              {activeOrders > 0 && (
                <span>
                  <span className="font-bold text-neutral-900 tabular-nums">
                    {activeOrders}
                  </span>{" "}
                  активн.
                </span>
              )}
              {activeOrders > 0 && !isIndividual && companies.length > 0 && (
                <span className="mx-2 text-neutral-200">·</span>
              )}
              {!isIndividual && companies.length > 0 && (
                <span>
                  <span className="font-bold text-neutral-900 tabular-nums">
                    {companies.length}
                  </span>{" "}
                  комп.
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Orders ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] uppercase">
            Последние заказы
          </h2>
          {orders.length > 0 && (
            <Link
              href="/dashboard/orders"
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
            <p className="text-[14px] font-bold text-neutral-900">
              Нет заказов
            </p>
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
                  href="/dashboard/orders"
                  className="block bg-white rounded-xl border border-black/[0.04] px-4 sm:px-5 py-3 sm:py-4 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[14px] font-black text-neutral-900 tabular-nums">
                          {formatOrderNumber(order.order_id)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              STATUS_DOTS[order.status]
                            )}
                          />
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
                      <p className="text-[10px] text-neutral-300 mt-1">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── News ── */}
      {!isIndividual && news.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] uppercase">
              Новости
            </h2>
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
                    <Image
                      src={item.cover_image}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
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
                    <p className="text-[10px] text-neutral-300 mt-1.5">
                      {formatDate(item.published_at)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Companies ── */}
      {!isIndividual && companies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold text-neutral-400 tracking-[0.2em] uppercase">
              Компании
            </h2>
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
                  <p className="text-[13px] font-bold text-neutral-900 truncate">
                    {company.name}
                  </p>
                  <p className="text-[10px] text-neutral-400 tabular-nums">
                    ИНН {company.inn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
