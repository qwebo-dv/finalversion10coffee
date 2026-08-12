import type { Endpoint } from "payload"
import { canReadOperations } from "../access/adminRoles"
import { dbQuery } from "@/lib/db"

type Period = "7" | "30" | "90" | "all"

interface MetricRow {
  [key: string]: unknown
  total: string | number
  unique_clients: string | number
  unique_products: string | number
  previous_total: string | number
}

interface ProductRow {
  [key: string]: unknown
  id: string | number
  name: string | null
  count: string | number
  client_count: string | number
}

interface ClientRow {
  [key: string]: unknown
  id: string
  payload_id: string | number | null
  name: string | null
  email: string | null
  count?: string | number
  unique_products?: string | number
  product_id?: string | number
}

interface RecentRow {
  [key: string]: unknown
  id: string | number
  product_id: string | number
  product_name: string | null
  client_id: string
  payload_id: string | number | null
  client_name: string | null
  email: string | null
  created_at: string | Date
}

interface TimelineRow {
  [key: string]: unknown
  bucket: string | Date
  count: string | number
}

function clientSummary(row: ClientRow) {
  return {
    id: row.id,
    payloadId: row.payload_id == null ? undefined : String(row.payload_id),
    name: row.name || row.email || `Клиент ${row.id.slice(0, 8)}…`,
    email: row.email || undefined,
  }
}

export const favoritesAnalyticsHandler: Endpoint["handler"] = async (req) => {
  if (!canReadOperations(req.user)) {
    return Response.json({ error: "Недостаточно прав для просмотра аналитики" }, { status: 403 })
  }

  try {
  const requestedPeriod = req.url
    ? new URL(req.url, "http://payload.local").searchParams.get("period")
    : null
  const period: Period = requestedPeriod === "7" || requestedPeriod === "30" || requestedPeriod === "90"
    ? requestedPeriod
    : "all"
  const days = period === "all" ? null : Number(period)
  const now = new Date()
  const currentStart = days ? new Date(now) : null
  if (currentStart && days) {
    currentStart.setHours(0, 0, 0, 0)
    currentStart.setDate(currentStart.getDate() - days + 1)
  }
  const previousStart = currentStart && days ? new Date(currentStart) : null
  if (previousStart && days) previousStart.setDate(previousStart.getDate() - days)
  const currentFilter = currentStart ? "WHERE f.created_at >= $1" : ""
  const currentParams = currentStart ? [currentStart] : []

  const metricsResult = currentStart && previousStart
    ? await dbQuery<MetricRow>(`
        SELECT
          COUNT(*) FILTER (WHERE f.created_at >= $1) AS total,
          COUNT(DISTINCT f.client_id) FILTER (WHERE f.created_at >= $1) AS unique_clients,
          COUNT(DISTINCT f.product_id) FILTER (WHERE f.created_at >= $1) AS unique_products,
          COUNT(*) FILTER (
            WHERE f.created_at >= $2 AND f.created_at < $1
          ) AS previous_total
        FROM favorites f
        WHERE f.created_at >= $2
      `, [currentStart, previousStart])
    : await dbQuery<MetricRow>(`
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT f.client_id) AS unique_clients,
          COUNT(DISTINCT f.product_id) AS unique_products,
          0 AS previous_total
        FROM favorites f
      `)

  const productsResult = await dbQuery<ProductRow>(`
    SELECT
      f.product_id AS id,
      COALESCE(p.name, 'Удалённый товар') AS name,
      COUNT(*) AS count,
      COUNT(DISTINCT f.client_id) AS client_count
    FROM favorites f
    LEFT JOIN products p ON p.id = f.product_id
    ${currentFilter}
    GROUP BY f.product_id, p.name
    ORDER BY count DESC, name ASC
    LIMIT 10
  `, currentParams)

  const topProductIds = productsResult.rows.map((row) => Number(row.id)).filter(Number.isFinite)
  const productClientsResult = topProductIds.length > 0
    ? await dbQuery<ClientRow>(`
        WITH distinct_favorites AS (
          SELECT f.product_id, f.client_id, MAX(f.created_at) AS created_at
          FROM favorites f
          WHERE f.product_id = ANY($1::int[])
            ${currentStart ? "AND f.created_at >= $2" : ""}
          GROUP BY f.product_id, f.client_id
        ), ranked_clients AS (
          SELECT
            f.product_id,
            f.client_id AS id,
            c.id AS payload_id,
            c.full_name AS name,
            c.email,
            ROW_NUMBER() OVER (PARTITION BY f.product_id ORDER BY f.created_at DESC) AS position
          FROM distinct_favorites f
          LEFT JOIN clients c ON c.supabase_id = f.client_id
        )
        SELECT product_id, id, payload_id, name, email
        FROM ranked_clients
        WHERE position <= 5
        ORDER BY product_id, position
      `, currentStart ? [topProductIds, currentStart] : [topProductIds])
    : { rows: [] as ClientRow[] }

  const clientsByProduct = new Map<string, ReturnType<typeof clientSummary>[]>()
  for (const row of productClientsResult.rows) {
    const productId = String(row.product_id)
    const clients = clientsByProduct.get(productId) || []
    clients.push(clientSummary(row))
    clientsByProduct.set(productId, clients)
  }

  const clientsResult = await dbQuery<ClientRow>(`
    SELECT
      f.client_id AS id,
      c.id AS payload_id,
      c.full_name AS name,
      c.email,
      COUNT(*) AS count,
      COUNT(DISTINCT f.product_id) AS unique_products
    FROM favorites f
    LEFT JOIN clients c ON c.supabase_id = f.client_id
    ${currentFilter}
    GROUP BY f.client_id, c.id, c.full_name, c.email
    ORDER BY count DESC, name ASC NULLS LAST
    LIMIT 8
  `, currentParams)

  const recentResult = await dbQuery<RecentRow>(`
    SELECT
      f.id,
      f.product_id,
      COALESCE(p.name, 'Удалённый товар') AS product_name,
      f.client_id,
      c.id AS payload_id,
      c.full_name AS client_name,
      c.email,
      f.created_at
    FROM favorites f
    LEFT JOIN products p ON p.id = f.product_id
    LEFT JOIN clients c ON c.supabase_id = f.client_id
    ${currentFilter}
    ORDER BY f.created_at DESC
    LIMIT 8
  `, currentParams)

  const timelineResult = days
    ? await dbQuery<TimelineRow>(`
        WITH buckets AS (
          SELECT GENERATE_SERIES(
            CURRENT_DATE - ($1 * INTERVAL '1 day'),
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS bucket
        ), totals AS (
          SELECT f.created_at::date AS bucket, COUNT(*) AS count
          FROM favorites f
          WHERE f.created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
          GROUP BY f.created_at::date
        )
        SELECT buckets.bucket, COALESCE(totals.count, 0) AS count
        FROM buckets
        LEFT JOIN totals USING (bucket)
        ORDER BY buckets.bucket
      `, [days - 1])
    : await dbQuery<TimelineRow>(`
        WITH bounds AS (
          SELECT COALESCE(DATE_TRUNC('month', MIN(created_at)), DATE_TRUNC('month', CURRENT_DATE)) AS first_month
          FROM favorites
        ), buckets AS (
          SELECT GENERATE_SERIES(
            (SELECT first_month FROM bounds),
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS bucket
        ), totals AS (
          SELECT DATE_TRUNC('month', f.created_at) AS bucket, COUNT(*) AS count
          FROM favorites f
          GROUP BY DATE_TRUNC('month', f.created_at)
        )
        SELECT buckets.bucket, COALESCE(totals.count, 0) AS count
        FROM buckets
        LEFT JOIN totals USING (bucket)
        ORDER BY buckets.bucket
      `)

  const metrics = metricsResult.rows[0] || {
    total: 0,
    unique_clients: 0,
    unique_products: 0,
    previous_total: 0,
  }
  const total = Number(metrics.total) || 0
  const previousTotal = Number(metrics.previous_total) || 0
  const trendPercent = days === null
    ? null
    : previousTotal === 0
      ? total > 0 ? 100 : 0
      : Math.round(((total - previousTotal) / previousTotal) * 100)

  return Response.json({
    period,
    generatedAt: now.toISOString(),
    metrics: {
      total,
      uniqueClients: Number(metrics.unique_clients) || 0,
      uniqueProducts: Number(metrics.unique_products) || 0,
      previousTotal,
      trendPercent,
    },
    timeline: {
      granularity: days ? "day" : "month",
      points: timelineResult.rows.map((point) => ({
        date: new Date(point.bucket).toISOString(),
        count: Number(point.count) || 0,
      })),
    },
    topProducts: productsResult.rows.map((product) => ({
      id: String(product.id),
      name: product.name || `Товар #${product.id}`,
      count: Number(product.count) || 0,
      clientCount: Number(product.client_count) || 0,
      share: total > 0 ? Math.round(((Number(product.count) || 0) / total) * 100) : 0,
      clients: clientsByProduct.get(String(product.id)) || [],
    })),
    topClients: clientsResult.rows.map((client) => ({
      ...clientSummary(client),
      count: Number(client.count) || 0,
      uniqueProducts: Number(client.unique_products) || 0,
    })),
    recent: recentResult.rows.map((favorite) => ({
      id: String(favorite.id),
      product: { id: String(favorite.product_id), name: favorite.product_name || `Товар #${favorite.product_id}` },
      client: clientSummary({
        id: favorite.client_id,
        payload_id: favorite.payload_id,
        name: favorite.client_name,
        email: favorite.email,
      }),
      createdAt: new Date(favorite.created_at).toISOString(),
    })),
  })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: "Не удалось построить аналитику избранного" })
    return Response.json({ error: "Не удалось загрузить аналитику. Подробности записаны в журнал сервера." }, { status: 500 })
  }
}
