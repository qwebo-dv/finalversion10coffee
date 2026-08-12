"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@payloadcms/ui"
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarClock,
  ClipboardList,
  Coffee,
  FileText,
  Gift,
  Heart,
  Inbox,
  Package,
  RefreshCw,
  ShoppingCart,
  Star,
  Truck,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"
import "./BusinessDashboard.scss"

type Period = "7" | "30" | "90" | "all"

interface TimelinePoint { date: string; orders: number; revenue: number }
interface CountItem { value: string; count: number; share?: number; revenue?: number }
interface ProductItem { name: string; qty: number; revenue: number; orders: number; share: number }
interface ClientItem { name: string; payloadId?: string; email?: string; orders: number; revenue: number }
interface RecentOrder { id: string; orderId: string; customer: string; customerType: string; status: string; paymentStatus: string; total: number; createdAt: string }
interface MoyskladItem { value: string; count: number }

interface DashboardResponse {
  error?: string
  workspace: "wholesale" | "retail" | "all"
  period: Period
  generatedAt: string
  metrics: {
    totalOrders: number
    validOrders: number
    totalRevenue: number
    avgOrder: number
    totalClients: number
    newClients: number
    pendingReviews: number
    pendingPriceRequests: number
    activePromos: number
    promoUses: number
    visibleProducts: number
    periodRevenue: number
    previousRevenue: number
    periodOrders: number
    previousOrders: number
    revenueTrend: number | null
    ordersTrend: number | null
  }
  timeline: { granularity: "day" | "month"; points: TimelinePoint[] }
  statuses: CountItem[]
  payments: CountItem[]
  customerTypes: CountItem[]
  deliveries: CountItem[]
  topProducts: ProductItem[]
  topClients: ClientItem[]
  recentOrders: RecentOrder[]
  moysklad: MoyskladItem[]
}

const PERIOD_LABELS: Record<Period, string> = {
  "7": "7 дней",
  "30": "30 дней",
  "90": "90 дней",
  all: "Всё время",
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новые",
  confirmed: "Подтверждены",
  invoiced: "Счёт выставлен",
  paid: "Оплачены",
  in_production: "В производстве",
  ready: "Собраны",
  shipped: "Отгружены",
  delivered: "Доставлены",
  returned: "Возврат",
  cancelled: "Отменены",
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  invoiced: "Счёт выставлен",
  partial: "Частично оплачен",
  paid: "Оплачен",
  refunded: "Возврат",
  cancelled: "Отменён",
  failed: "Ошибка оплаты",
}

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  individual: "Физлица",
  business: "Юрлица / опт",
}

const DELIVERY_LABELS: Record<string, string> = {
  self_pickup: "Самовывоз",
  cdek: "СДЭК",
  cap_2000: "ЦАП 2000",
  sochi_delivery: "Доставка по Сочи",
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "#171717", returned: "#525252", cancelled: "#737373", shipped: "#262626",
  paid: "#171717", in_production: "#404040", ready: "#262626", confirmed: "#404040",
  new: "#525252", invoiced: "#404040", pending: "#525252", partial: "#525252",
  failed: "#737373", refunded: "#737373",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)
}

function formatShortCurrency(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`
  if (value >= 1_000) return `${(value / 1_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} тыс`
  return formatCurrency(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function TrendBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null) return <span className="trend-badge trend-badge--neutral">с начала</span>
  const up = value >= 0
  const good = invert ? !up : up
  const sign = up ? "+" : ""
  return (
    <span className={`trend-badge ${good ? "trend-badge--up" : "trend-badge--down"}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {sign}{value}%
    </span>
  )
}

function DualTimelineChart({ points, granularity }: { points: TimelinePoint[]; granularity: "day" | "month" }) {
  const [showRevenue, setShowRevenue] = useState(true)
  const [showOrders, setShowOrders] = useState(true)
  // A wide viewBox keeps the chart compact on large Payload screens instead of scaling it vertically.
  const width = 1200
  const height = 160
  const padding = { top: 16, right: 20, bottom: 26, left: 42 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxOrders = Math.max(1, ...points.map((point) => point.orders))
  const maxRevenue = Math.max(1, ...points.map((point) => point.revenue))
  const barSlot = points.length === 0 ? 1 : plotWidth / points.length
  const barWidth = Math.max(2, Math.min(18, barSlot * 0.55))
  const coords = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (point.revenue / maxRevenue) * plotHeight,
  }))
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ")
  const area = coords.length > 0
    ? `${padding.left},${padding.top + plotHeight} ${line} ${coords.at(-1)?.x},${padding.top + plotHeight}`
    : ""
  const labelStep = Math.max(1, Math.ceil(points.length / 8))
  const dateFormatter = new Intl.DateTimeFormat("ru-RU", granularity === "day"
    ? { day: "2-digit", month: "short" }
    : { month: "short", year: "2-digit" })
  const ordersStep = Math.max(1, Math.pow(10, String(maxOrders).length - 1) / 5)
  const niceMaxOrders = Math.ceil(maxOrders / ordersStep) * ordersStep
  const revenueStep = Math.max(1, Math.pow(10, String(maxRevenue).length - 1) / 5)
  const niceMaxRevenue = Math.ceil(maxRevenue / revenueStep) * revenueStep

  return (
    <div className="dual-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Выручка и заказы">
        <defs>
          <linearGradient id="dashboard-revenue-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#171717" stopOpacity=".16" />
            <stop offset="100%" stopColor="#171717" stopOpacity=".01" />
          </linearGradient>
        </defs>
        {[0, .5, 1].map((ratio) => {
          const y = padding.top + plotHeight * ratio
          const value = Math.round(niceMaxRevenue * (1 - ratio))
          return <g key={ratio}><line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="dual-chart__grid" /><text x={padding.left - 8} y={y + 4} textAnchor="end">{formatShortCurrency(value)}</text></g>
        })}
        {showOrders && points.map((point, index) => {
          const x = padding.left + (index + 0.5) * barSlot
          const barHeight = (point.orders / niceMaxOrders) * plotHeight
          return <rect key={`bar-${point.date}`} x={x - barWidth / 2} y={padding.top + plotHeight - barHeight} width={barWidth} height={barHeight} className="dual-chart__bar" rx="2"><title>{`${dateFormatter.format(new Date(point.date))}: ${point.orders} заказов`}</title></rect>
        })}
        {showRevenue && area && <polygon points={area} fill="url(#dashboard-revenue-area)" />}
        {showRevenue && line && <polyline points={line} className="dual-chart__line" />}
        {showRevenue && coords.map((point) => (
          <g className="dual-chart__point" key={point.date}>
            <circle cx={point.x} cy={point.y} r="3"><title>{`${dateFormatter.format(new Date(point.date))}: ${formatCurrency(point.revenue)} ₽`}</title></circle>
          </g>
        ))}
        {points.map((point, index) => (
          (index % labelStep === 0 || index === points.length - 1) && (
            <text key={`lbl-${point.date}`} x={coords[index].x} y={height - 6} textAnchor="middle" className="dual-chart__label">{dateFormatter.format(new Date(point.date))}</text>
          )
        ))}
      </svg>
      <div className="dual-chart__legend" aria-label="Легенда графика">
        <button type="button" className={!showRevenue ? "is-hidden" : undefined} onClick={() => setShowRevenue((visible) => !visible)} aria-pressed={showRevenue}>
          <i className="dual-chart__legend-line" />Выручка
        </button>
        <button type="button" className={!showOrders ? "is-hidden" : undefined} onClick={() => setShowOrders((visible) => !visible)} aria-pressed={showOrders}>
          <i className="dual-chart__legend-bar" />Заказы
        </button>
      </div>
    </div>
  )
}

function MiniBars({ items, max, color }: { items: CountItem[]; max: number; color: string }) {
  if (items.length === 0) return <div className="mini-bars mini-bars--empty">Нет данных</div>
  return (
    <div className="mini-bars">
      {items.map((item) => (
        <div className="mini-bar" key={item.value}>
          <span className="mini-bar__label" style={{ color }}>{item.value}</span>
          <span className="mini-bar__track"><i style={{ width: `${Math.max(3, (item.count / max) * 100)}%`, background: color }} /></span>
          <b>{item.count}</b>
          {typeof item.share === "number" && <small>{item.share}%</small>}
        </div>
      ))}
    </div>
  )
}

export default function BusinessDashboard() {
  const { user } = useAuth()
  const role = (user as { role?: string } | null)?.role
  const canViewDashboard = Boolean(role && ["admin", "manager", "super_admin", "content_manager", "wholesale_manager", "retail_manager", "support", "integration_operator"].includes(role))
  const [period, setPeriod] = useState<Period>("30")
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!canViewDashboard) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/business-dashboard?period=${period}`, { credentials: "include" })
      const json = await response.json() as DashboardResponse
      if (!response.ok) throw new Error(json.error || "Не удалось загрузить дашборд")
      setData(json)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить дашборд")
    } finally {
      setLoading(false)
    }
  }, [canViewDashboard, period])

  useEffect(() => {
    void load()
  }, [load])

  const statusItems = useMemo(() => (data?.statuses || []).map((item) => ({
    ...item,
    value: ORDER_STATUS_LABELS[item.value] || item.value,
  })), [data])

  const paymentItems = useMemo(() => (data?.payments || []).map((item) => ({
    ...item,
    value: PAYMENT_STATUS_LABELS[item.value] || item.value,
  })), [data])

  const customerTypeItems = useMemo(() => (data?.customerTypes || []).map((item) => ({
    ...item,
    value: CUSTOMER_TYPE_LABELS[item.value] || item.value,
  })), [data])

  const deliveryItems = useMemo(() => (data?.deliveries || []).map((item) => ({
    ...item,
    value: DELIVERY_LABELS[item.value] || item.value,
  })), [data])

  const maxStatus = Math.max(1, ...statusItems.map((item) => item.count))
  const maxPayment = Math.max(1, ...paymentItems.map((item) => item.count))
  const maxDelivery = Math.max(1, ...deliveryItems.map((item) => item.count))
  const maxProductRevenue = Math.max(1, ...(data?.topProducts || []).map((item) => item.revenue))

  if (!canViewDashboard) return null
  const m = data?.metrics
  const periodRevenue = m?.periodRevenue ?? 0
  const periodOrders = m?.periodOrders ?? 0

  return (
    <section className="business-dashboard">
      <div className="business-dashboard__header">
        <div>
          <div className="business-dashboard__eyebrow">
            {data?.workspace === "wholesale" ? "Оптовый контур" : data?.workspace === "retail" ? "Розничный контур" : "Сводно по всем контурам"}
          </div>
          <p>Заказы, клиенты и показатели отфильтрованы выбранным рабочим пространством.</p>
        </div>
        <div className="business-dashboard__controls">
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Период дашборда">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} title="Обновить дашборд">
            <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
            Обновить
          </button>
        </div>
      </div>

      {error && <div className="business-dashboard__error">{error}</div>}

      {/* ── Revenue hero ─────────────────────────────────── */}
      <div className="business-dashboard__hero">
        <div className="hero-card hero-card--revenue">
          <div className="hero-card__label"><Wallet size={15} /> Выручка за период</div>
          <div className="hero-card__value">{loading ? "—" : `${formatCurrency(periodRevenue)} ₽`}</div>
          <div className="hero-card__meta">
            <TrendBadge value={loading ? null : m?.revenueTrend ?? null} />
            <span>за {period === "all" ? "всё время" : PERIOD_LABELS[period].toLowerCase()}</span>
          </div>
        </div>
        <div className="hero-card hero-card--orders">
          <div className="hero-card__label"><ShoppingCart size={15} /> Заказов за период</div>
          <div className="hero-card__value">{loading ? "—" : periodOrders}</div>
          <div className="hero-card__meta">
            <TrendBadge value={loading ? null : m?.ordersTrend ?? null} />
            <span>за {period === "all" ? "всё время" : PERIOD_LABELS[period].toLowerCase()}</span>
          </div>
        </div>
        <div className="hero-card hero-card--clients">
          <div className="hero-card__label"><Users size={15} /> Всего клиентов</div>
          <div className="hero-card__value">{loading ? "—" : m?.totalClients ?? 0}</div>
          <div className="hero-card__meta">
            {m && m.newClients > 0 && <span className="hero-card__new"><UserPlus size={13} /> +{m.newClients} за период</span>}
            {m && m.newClients === 0 && <span>новых за период нет</span>}
          </div>
        </div>
        <div className="hero-card hero-card--avg">
          <div className="hero-card__label"><Banknote size={15} /> Средний чек</div>
          <div className="hero-card__value">{loading ? "—" : `${formatCurrency(m?.avgOrder ?? 0)} ₽`}</div>
          <div className="hero-card__meta"><span>по всем заказам без отмен</span></div>
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────── */}
      {!loading && data && (
        <article className="business-panel business-panel--chart">
          <div className="business-panel__title">
            <div><h3>Выручка и заказы</h3><span>{data.timeline.granularity === "day" ? "По дням" : "По месяцам"}</span></div>
            <span className="chart-total">{formatShortCurrency(data.metrics.totalRevenue)} ₽ · всего {data.metrics.totalOrders} заказов</span>
          </div>
          <DualTimelineChart points={data.timeline.points} granularity={data.timeline.granularity} />
        </article>
      )}

      {/* ── Distribution grid ────────────────────────────── */}
      <div className="business-dashboard__grid">
        <article className="business-panel">
          <div className="business-panel__title"><div><h3>Статусы заказов</h3><span>Распределение всех заказов</span></div><ClipboardList size={17} /></div>
          <MiniBars items={statusItems} max={maxStatus} color="#171717" />
        </article>
        <article className="business-panel">
          <div className="business-panel__title"><div><h3>Оплаты</h3><span>Статусы платежей</span></div><Wallet size={17} /></div>
          <MiniBars items={paymentItems} max={maxPayment} color="#262626" />
        </article>
        <article className="business-panel">
          <div className="business-panel__title"><div><h3>Типы покупателей</h3><span>Физлица и юрлица</span></div><Users size={17} /></div>
          {customerTypeItems.length === 0 ? <div className="mini-bars mini-bars--empty">Нет данных</div> : (
            <div className="type-split">
              {customerTypeItems.map((item) => (
                <div className="type-split__row" key={item.value}>
                  <span className="type-split__name">{item.value}</span>
                  <strong>{item.count}</strong>
                  <small>{formatCurrency(item.revenue ?? 0)} ₽</small>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="business-panel">
          <div className="business-panel__title"><div><h3>Доставка</h3><span>Способы доставки</span></div><Truck size={17} /></div>
          <MiniBars items={deliveryItems} max={maxDelivery} color="#404040" />
        </article>
      </div>

      {/* ── Products & clients ───────────────────────────── */}
      <div className="business-dashboard__columns">
        <article className="business-panel">
          <div className="business-panel__title"><div><h3>Топ товаров</h3><span>По выручке за период</span></div><Package size={17} /></div>
          <div className="top-products">
            {(data?.topProducts || []).map((product, index) => (
              <div className="top-product" key={product.name}>
                <span className="top-product__rank">{index + 1}</span>
                <div className="top-product__body">
                  <div className="top-product__line">
                    <strong title={product.name}>{product.name}</strong>
                    <b>{formatShortCurrency(product.revenue)} ₽</b>
                  </div>
                  <div className="top-product__bar"><span style={{ width: `${Math.max(4, (product.revenue / maxProductRevenue) * 100)}%` }} /></div>
                  <div className="top-product__meta">
                    <span><Package size={11} /> {Math.round(product.qty)} шт</span>
                    <span><ShoppingCart size={11} /> {product.orders} заказов</span>
                    <span className="top-product__share">{product.share}% выручки</span>
                  </div>
                </div>
              </div>
            ))}
            {(data?.topProducts || []).length === 0 && <div className="mini-bars mini-bars--empty">За период продаж нет</div>}
          </div>
        </article>

        <article className="business-panel">
          <div className="business-panel__title"><div><h3>Топ клиентов</h3><span>По выручке за период</span></div><Users size={17} /></div>
          <div className="top-clients">
            {(data?.topClients || []).map((client, index) => (
              <div className="top-client" key={client.name}>
                <span className="top-client__rank">{index + 1}</span>
                <div className="top-client__info">
                  {client.payloadId ? <a href={`/admin/collections/clients/${client.payloadId}`}>{client.name}</a> : <strong>{client.name}</strong>}
                  <small>{client.email || `${client.orders} заказов`}</small>
                </div>
                <div className="top-client__right">
                  <b>{formatShortCurrency(client.revenue)} ₽</b>
                  <small>{client.orders} зак.</small>
                </div>
              </div>
            ))}
            {(data?.topClients || []).length === 0 && <div className="mini-bars mini-bars--empty">За период продаж нет</div>}
          </div>
        </article>
      </div>

      {/* ── Operations strip ─────────────────────────────── */}
      <div className="business-dashboard__ops">
        <div className="ops-item"><i className="ops-icon ops-icon--purple"><Star size={16} /></i><span><strong>{loading ? "—" : m?.pendingReviews ?? 0}</strong><small>Отзывов на модерации</small></span></div>
        <div className="ops-item"><i className="ops-icon ops-icon--amber"><FileText size={16} /></i><span><strong>{loading ? "—" : m?.pendingPriceRequests ?? 0}</strong><small>Заявок на прайс</small></span></div>
        <div className="ops-item"><i className="ops-icon ops-icon--green"><Gift size={16} /></i><span><strong>{loading ? "—" : m?.promoUses ?? 0}</strong><small>Использований промокодов ({loading ? "—" : m?.activePromos ?? 0} активных)</small></span></div>
        <div className="ops-item"><i className="ops-icon ops-icon--brown"><Coffee size={16} /></i><span><strong>{loading ? "—" : m?.visibleProducts ?? 0}</strong><small>Товаров на сайте</small></span></div>
        <div className="ops-item"><i className="ops-icon ops-icon--sky"><Heart size={16} /></i><span><strong>{loading ? "—" : (data?.deliveries.reduce((sum, item) => sum + item.count, 0) ?? 0)}</strong><small>Заказов с доставкой</small></span></div>
        <div className="ops-item"><i className="ops-icon ops-icon--red"><AlertTriangle size={16} /></i><span><strong>{loading ? "—" : (data?.moysklad.find((item) => item.value === "error")?.count ?? 0)}</strong><small>Ошибок МойСклад</small></span></div>
      </div>

      {/* ── Recent orders ────────────────────────────────── */}
      {!loading && data && (
        <article className="business-panel business-panel--recent">
          <div className="business-panel__title"><div><h3>Последние заказы</h3><span>Самые свежие поступления</span></div><CalendarClock size={17} /></div>
          <div className="recent-orders">
            {data.recentOrders.length === 0 && <div className="mini-bars mini-bars--empty">Заказов пока нет</div>}
            {data.recentOrders.map((order) => (
              <div className="recent-order" key={order.id}>
                <a className="recent-order__id" href={`/admin/collections/orders/${order.id}`}>{order.orderId}</a>
                <span className="recent-order__customer">{order.customer}</span>
                <span className="recent-order__type">{CUSTOMER_TYPE_LABELS[order.customerType] || order.customerType}</span>
                <span className="recent-order__status" style={{ background: `${STATUS_COLORS[order.status] || "#525252"}1a`, color: STATUS_COLORS[order.status] || "#525252" }}>
                  {ORDER_STATUS_LABELS[order.status] || order.status}
                </span>
                <span className="recent-order__status" style={{ background: `${STATUS_COLORS[order.paymentStatus] || "#525252"}1a`, color: STATUS_COLORS[order.paymentStatus] || "#525252" }}>
                  {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                </span>
                <b className="recent-order__total">{formatCurrency(order.total)} ₽</b>
                <span className="recent-order__time">{formatDate(order.createdAt)}</span>
              </div>
            ))}
          </div>
        </article>
      )}

      {!loading && data && data.metrics.totalOrders === 0 && (
        <div className="business-dashboard__empty"><Inbox size={22} /> Заказов пока нет — как только появятся, здесь появится статистика.</div>
      )}

      <div className="business-dashboard__footer">
        <span><BadgeCheck size={13} /> Обновлено: {data ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(data.generatedAt)) : "—"}</span>
        <span>Суммы без учёта отменённых и возвращённых заказов</span>
      </div>
    </section>
  )
}
