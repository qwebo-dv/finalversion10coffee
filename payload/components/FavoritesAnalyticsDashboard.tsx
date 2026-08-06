"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useAuth } from "@payloadcms/ui"
import { BarChart3, Clock3, Heart, Package, RefreshCw, Users } from "lucide-react"
import "./FavoritesAnalyticsDashboard.scss"

type Period = "7" | "30" | "90" | "all"

interface ClientSummary {
  id: string
  payloadId?: string
  name: string
  email?: string
}

interface AnalyticsResponse {
  error?: string
  metrics: {
    total: number
    uniqueClients: number
    uniqueProducts: number
    previousTotal: number
    trendPercent: number | null
  }
  timeline: {
    granularity: "day" | "month"
    points: Array<{ date: string; count: number }>
  }
  topProducts: Array<{
    id: string
    name: string
    count: number
    clientCount: number
    share: number
    clients: ClientSummary[]
  }>
  topClients: Array<ClientSummary & { count: number; uniqueProducts: number }>
  recent: Array<{
    id: string
    product: { id: string; name: string }
    client: ClientSummary
    createdAt: string | null
  }>
}

const PERIOD_LABELS: Record<Period, string> = {
  "7": "7 дней",
  "30": "30 дней",
  "90": "90 дней",
  all: "Всё время",
}

function clientHref(client: ClientSummary) {
  return client.payloadId ? `/admin/collections/clients/${client.payloadId}` : undefined
}

function formatDate(value: string | null) {
  if (!value) return "Дата неизвестна"
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function TimelineChart({ timeline }: { timeline: AnalyticsResponse["timeline"] }) {
  const width = 900
  const height = 190
  const padding = { top: 18, right: 18, bottom: 34, left: 34 }
  const points = timeline.points
  const max = Math.max(1, ...points.map((point) => point.count))
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (point.count / max) * plotHeight,
  }))
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ")
  const area = coordinates.length > 0
    ? `${padding.left},${padding.top + plotHeight} ${line} ${coordinates.at(-1)?.x},${padding.top + plotHeight}`
    : ""
  const labelStep = Math.max(1, Math.ceil(points.length / 7))
  const dateFormatter = new Intl.DateTimeFormat("ru-RU", timeline.granularity === "day"
    ? { day: "2-digit", month: "short" }
    : { month: "short", year: "2-digit" })

  return (
    <div className="timeline-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика добавлений в избранное">
        <defs>
          <linearGradient id="favorites-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity=".28" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0, .25, .5, .75, 1].map((ratio) => {
          const y = padding.top + plotHeight * ratio
          const value = Math.round(max * (1 - ratio))
          return <g key={ratio}><line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="timeline-chart__grid" /><text x={padding.left - 8} y={y + 4} textAnchor="end">{value}</text></g>
        })}
        {area && <polygon points={area} fill="url(#favorites-area)" />}
        {line && <polyline points={line} className="timeline-chart__line" />}
        {coordinates.map((point, index) => (
          <g className="timeline-chart__point" key={point.date}>
            <circle cx={point.x} cy={point.y} r="4" />
            <title>{`${dateFormatter.format(new Date(point.date))}: ${point.count}`}</title>
            {(index % labelStep === 0 || index === coordinates.length - 1) && (
              <text x={point.x} y={height - 9} textAnchor="middle">{dateFormatter.format(new Date(point.date))}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

export default function FavoritesAnalyticsDashboard() {
  const { user } = useAuth()
  const isAdmin = (user as { role?: string } | null)?.role === "admin"
  const [period, setPeriod] = useState<Period>("all")
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/favorites/analytics?period=${period}`, { credentials: "include" })
      const json = await response.json() as AnalyticsResponse
      if (!response.ok) throw new Error(json.error || "Не удалось загрузить аналитику")
      setData(json)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить аналитику")
    } finally {
      setLoading(false)
    }
  }, [isAdmin, period])

  useEffect(() => {
    void load()
  }, [load])

  const maxProductCount = Math.max(1, ...(data?.topProducts.map((product) => product.count) || [1]))

  if (!isAdmin) return null

  return (
    <section className="favorites-analytics">
      <div className="favorites-analytics__header">
        <div>
          <div className="favorites-analytics__eyebrow"><BarChart3 size={14} /> Аналитика избранного</div>
          <h2>Что сохраняют клиенты</h2>
          <p>Популярность товаров и клиенты, добавившие их в избранное.</p>
        </div>
        <div className="favorites-analytics__controls">
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Период аналитики">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} title="Обновить аналитику">
            <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
            Обновить
          </button>
        </div>
      </div>

      {error && <div className="favorites-analytics__error">{error}</div>}

      <div className="favorites-analytics__metrics" aria-busy={loading}>
        <article><span className="metric-icon metric-icon--heart"><Heart size={18} /></span><div><strong>{loading ? "—" : data?.metrics.total || 0}</strong><span>Добавлений</span></div></article>
        <article><span className="metric-icon metric-icon--users"><Users size={18} /></span><div><strong>{loading ? "—" : data?.metrics.uniqueClients || 0}</strong><span>Клиентов</span></div></article>
        <article><span className="metric-icon metric-icon--products"><Package size={18} /></span><div><strong>{loading ? "—" : data?.metrics.uniqueProducts || 0}</strong><span>Товаров</span></div></article>
        <article>
          <span className="metric-icon metric-icon--trend"><BarChart3 size={18} /></span>
          <div>
            <strong>{loading ? "—" : data?.metrics.trendPercent == null ? "За всё время" : `${data.metrics.trendPercent >= 0 ? "+" : ""}${data.metrics.trendPercent}%`}</strong>
            <span>{period === "all" ? "Накопленные данные" : "К прошлому периоду"}</span>
          </div>
        </article>
      </div>

      {!loading && data && data.timeline.points.length > 0 && (
        <article className="analytics-panel analytics-panel--timeline">
          <div className="analytics-panel__title">
            <div><h3>Динамика добавлений</h3><span>{data.timeline.granularity === "day" ? "По дням" : "По месяцам"}</span></div>
            <span className="timeline-total"><Heart size={14} /> {data.metrics.total} за период</span>
          </div>
          <TimelineChart timeline={data.timeline} />
        </article>
      )}

      {!loading && data && data.metrics.total === 0 ? (
        <div className="favorites-analytics__empty"><Heart size={24} /> За выбранный период добавлений нет.</div>
      ) : (
        <div className="favorites-analytics__grid">
          <article className="analytics-panel analytics-panel--products">
            <div className="analytics-panel__title"><div><h3>Популярные товары</h3><span>Количество добавлений и кто добавил</span></div></div>
            <div className="popular-products">
              {(data?.topProducts || []).map((product, index) => (
                <div className="popular-product" key={product.id}>
                  <span className="popular-product__rank">{index + 1}</span>
                  <div className="popular-product__body">
                    <div className="popular-product__line">
                      <a href={`/admin/collections/products/${product.id}`}>{product.name}</a>
                      <strong>{product.count}</strong>
                    </div>
                    <div className="popular-product__bar"><span style={{ width: `${Math.max(4, (product.count / maxProductCount) * 100)}%` }} /></div>
                    <div className="popular-product__clients">
                      <span>{product.share}% всех добавлений</span>
                      <div>
                        {product.clients.slice(0, 4).map((client) => clientHref(client) ? (
                          <a key={client.id} href={clientHref(client)} title={client.email || client.name}>{client.name}</a>
                        ) : <span key={client.id} title={client.id}>{client.name}</span>)}
                        {product.clientCount > 4 && <span>+{product.clientCount - 4}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="analytics-panel">
            <div className="analytics-panel__title"><div><h3>Активные клиенты</h3><span>Больше всего товаров в избранном</span></div></div>
            <div className="active-clients">
              {(data?.topClients || []).map((client, index) => (
                <div className="active-client" key={client.id}>
                  <span>{index + 1}</span>
                  <div>
                    {clientHref(client) ? <a href={clientHref(client)}>{client.name}</a> : <strong>{client.name}</strong>}
                    <small>{client.email || `${client.uniqueProducts} уник. товаров`}</small>
                  </div>
                  <b>{client.count}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="analytics-panel analytics-panel--recent">
            <div className="analytics-panel__title"><div><h3>Последние добавления</h3><span>Самые свежие действия клиентов</span></div><Clock3 size={18} /></div>
            <div className="recent-favorites">
              {(data?.recent || []).map((favorite) => (
                <div key={favorite.id}>
                  <span className="recent-favorites__dot" />
                  <p><a href={`/admin/collections/products/${favorite.product.id}`}>{favorite.product.name}</a><small>{formatDate(favorite.createdAt)}</small></p>
                  {clientHref(favorite.client) ? <a href={clientHref(favorite.client)}>{favorite.client.name}</a> : <span>{favorite.client.name}</span>}
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
