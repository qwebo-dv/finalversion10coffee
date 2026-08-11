import type { Endpoint } from "payload"
import { dbQuery } from "@/lib/db"

type Period = "7" | "30" | "90" | "all"

// Cast Payload's PostgreSQL enum to text before comparing it with application
// status names. Production databases can briefly have an older enum while a
// deployment migration is pending; comparing an enum directly with a missing
// value makes the entire dashboard fail with PostgreSQL error 22P02.
const ACTIVE_STATUSES = "o.status::text NOT IN ('cancelled', 'returned')"

interface MetricRow {
  total_orders?: string | number
  valid_orders?: string | number
  total_revenue?: string | number
  avg_order?: string | number
  current_orders?: string | number
  previous_orders?: string | number
  current_revenue?: string | number
  previous_revenue?: string | number
  total_clients?: string | number
  new_clients?: string | number
  pending_reviews?: string | number
  pending_price_requests?: string | number
  active_promos?: string | number
  promo_uses?: string | number
  visible_products?: string | number
}

interface TimelineRow {
  bucket: string | Date
  orders: string | number
  revenue: string | number
}

interface CountRow {
  value: string
  count: string | number
  revenue?: string | number
}

interface ProductRow {
  name: string
  qty: string | number
  revenue: string | number
  orders: string | number
}

interface ClientRow {
  name: string
  payload_id: string | number | null
  email: string | null
  orders: string | number
  revenue: string | number
}

interface RecentOrderRow {
  id: string | number
  order_id: string | null
  customer: string | null
  email: string | null
  customer_type: string
  status: string
  payment_status: string
  total: string | number
  created_at: string | Date
}

interface MoyskladRow {
  moysklad_sync_status: string
  count: string | number
}

const ACTIVE_STATUS = "status::text NOT IN ('cancelled', 'returned')"

async function safeDashboardQuery<T>(
  label: string,
  query: () => Promise<{ rows: T[] }>,
  required = false,
): Promise<{ rows: T[] }> {
  try {
    return await query()
  } catch (error) {
    // One optional module (reviews, promo codes, МойСклад, etc.) must not
    // prevent the sales and order statistics from loading altogether.
    console.error(`[business-dashboard] ${label} query failed`, error)
    if (required) throw error
    return { rows: [] }
  }
}

export const businessDashboardHandler: Endpoint["handler"] = async (req) => {
  const user = req.user as { collection?: string; role?: string } | null
  if (!user || user.collection !== "admins" || user.role !== "admin") {
    return Response.json({ error: "Доступ разрешён только администраторам" }, { status: 403 })
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
    const currentFilter = currentStart ? "AND o.created_at >= $1" : ""
    const currentParams = currentStart ? [currentStart] : []

    // ── All-time & period KPIs ────────────────────────────────
    const kpiResult = await safeDashboardQuery("kpi", () => dbQuery<MetricRow>(`
      SELECT
        COUNT(*) AS total_orders,
        COUNT(*) FILTER (WHERE ${ACTIVE_STATUS}) AS valid_orders,
        COALESCE(SUM(total) FILTER (WHERE ${ACTIVE_STATUS}), 0) AS total_revenue,
        COALESCE(AVG(total) FILTER (WHERE ${ACTIVE_STATUS}), 0) AS avg_order
      FROM orders
    `), true)

    const periodResult = currentStart && previousStart
      ? await safeDashboardQuery("period", () => dbQuery<MetricRow>(`
          SELECT
            COUNT(*) FILTER (WHERE ${ACTIVE_STATUS} AND created_at >= $1) AS current_orders,
            COALESCE(SUM(total) FILTER (WHERE ${ACTIVE_STATUS} AND created_at >= $1), 0) AS current_revenue,
            COUNT(*) FILTER (WHERE ${ACTIVE_STATUS} AND created_at >= $2 AND created_at < $1) AS previous_orders,
            COALESCE(SUM(total) FILTER (WHERE ${ACTIVE_STATUS} AND created_at >= $2 AND created_at < $1), 0) AS previous_revenue
          FROM orders
          WHERE created_at >= $2
        `, [currentStart, previousStart]))
      : null

    const clientsResult = await safeDashboardQuery("clients", () => dbQuery<MetricRow>(`
      SELECT
        COUNT(*) AS total_clients,
        COUNT(*) FILTER (WHERE created_at >= $1) AS new_clients
      FROM clients
    `, currentStart ? [currentStart] : [new Date(0)]))

    const countersResult = await safeDashboardQuery("operational counters", () => dbQuery<MetricRow>(`
      SELECT
        (SELECT COUNT(*) FROM product_reviews WHERE status = 'pending') AS pending_reviews,
        (SELECT COUNT(*) FROM price_list_requests WHERE email_sent = false) AS pending_price_requests,
        (SELECT COUNT(*) FROM promo_codes WHERE is_active = true) AS active_promos,
        (SELECT COALESCE(SUM(current_uses), 0) FROM promo_codes) AS promo_uses,
        (SELECT COUNT(*) FROM products WHERE is_visible = true) AS visible_products
    `))

    // ── Timeline: orders + revenue ────────────────────────────
    const timelineResult = days
      ? await safeDashboardQuery("daily timeline", () => dbQuery<TimelineRow>(`
          WITH buckets AS (
            SELECT GENERATE_SERIES(
              CURRENT_DATE - ($1 * INTERVAL '1 day'),
              CURRENT_DATE,
              INTERVAL '1 day'
            )::date AS bucket
          ), totals AS (
            SELECT
              created_at::date AS bucket,
              COUNT(*) FILTER (WHERE ${ACTIVE_STATUS}) AS orders,
              COALESCE(SUM(total) FILTER (WHERE ${ACTIVE_STATUS}), 0) AS revenue
            FROM orders
            WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
            GROUP BY created_at::date
          )
          SELECT buckets.bucket, COALESCE(totals.orders, 0) AS orders, COALESCE(totals.revenue, 0) AS revenue
          FROM buckets
          LEFT JOIN totals USING (bucket)
          ORDER BY buckets.bucket
        `, [days - 1]))
      : await safeDashboardQuery("monthly timeline", () => dbQuery<TimelineRow>(`
          WITH bounds AS (
            SELECT COALESCE(DATE_TRUNC('month', MIN(created_at)), DATE_TRUNC('month', CURRENT_DATE)) AS first_month
            FROM orders
          ), buckets AS (
            SELECT GENERATE_SERIES(
              (SELECT first_month FROM bounds),
              DATE_TRUNC('month', CURRENT_DATE),
              INTERVAL '1 month'
            ) AS bucket
          ), totals AS (
            SELECT
              DATE_TRUNC('month', created_at) AS bucket,
              COUNT(*) FILTER (WHERE ${ACTIVE_STATUS}) AS orders,
              COALESCE(SUM(total) FILTER (WHERE ${ACTIVE_STATUS}), 0) AS revenue
            FROM orders
            GROUP BY DATE_TRUNC('month', created_at)
          )
          SELECT buckets.bucket, COALESCE(totals.orders, 0) AS orders, COALESCE(totals.revenue, 0) AS revenue
          FROM buckets
          LEFT JOIN totals USING (bucket)
          ORDER BY buckets.bucket
        `))

    // ── Distributions ─────────────────────────────────────────
    const statusResult = await safeDashboardQuery("order statuses", () => dbQuery<CountRow>(`
      SELECT status AS value, COUNT(*) AS count
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `))

    const paymentResult = await safeDashboardQuery("payment statuses", () => dbQuery<CountRow>(`
      SELECT payment_status AS value, COUNT(*) AS count
      FROM orders
      GROUP BY payment_status
      ORDER BY count DESC
    `))

    const customerTypeResult = await safeDashboardQuery("customer types", () => dbQuery<CountRow>(`
      SELECT customer_type AS value, COUNT(*) AS count, COALESCE(SUM(total) FILTER (WHERE ${ACTIVE_STATUS}), 0) AS revenue
      FROM orders
      GROUP BY customer_type
      ORDER BY count DESC
    `))

    const deliveryResult = await safeDashboardQuery("delivery methods", () => dbQuery<CountRow>(`
      SELECT delivery_method AS value, COUNT(*) AS count
      FROM orders
      GROUP BY delivery_method
      ORDER BY count DESC
    `))

    // ── Top products & clients (period-aware) ─────────────────
    const topProductsResult = await safeDashboardQuery("top products", () => dbQuery<ProductRow>(`
      SELECT
        i.product_name AS name,
        SUM(i.quantity) AS qty,
        SUM(i.total_price) AS revenue,
        COUNT(DISTINCT o.id) AS orders
      FROM orders_items i
      JOIN orders o ON o.id = i._parent_id
      WHERE ${ACTIVE_STATUSES}
        ${currentFilter}
      GROUP BY i.product_name
      ORDER BY revenue DESC
      LIMIT 8
    `, currentParams))

    const topClientsResult = await safeDashboardQuery("top clients", () => dbQuery<ClientRow>(`
      SELECT
        COALESCE(c.full_name, o.customer_full_name, o.customer_email, 'Гость') AS name,
        c.id AS payload_id,
        o.customer_email AS email,
        COUNT(DISTINCT o.id) AS orders,
        COALESCE(SUM(o.total), 0) AS revenue
      FROM orders o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE ${ACTIVE_STATUSES}
        ${currentFilter}
      GROUP BY COALESCE(c.full_name, o.customer_full_name, o.customer_email, 'Гость'), c.id, o.customer_email
      ORDER BY revenue DESC
      LIMIT 8
    `, currentParams))

    const recentResult = await safeDashboardQuery("recent orders", () => dbQuery<RecentOrderRow>(`
      SELECT
        o.id,
        o.order_id,
        COALESCE(c.full_name, o.customer_full_name, o.customer_email, 'Гость') AS customer,
        o.customer_email AS email,
        o.customer_type,
        o.status,
        o.payment_status,
        o.total,
        o.created_at
      FROM orders o
      LEFT JOIN clients c ON c.id = o.client_id
      ORDER BY o.created_at DESC
      LIMIT 8
    `))

    const moyskladResult = await safeDashboardQuery("moysklad statuses", () => dbQuery<MoyskladRow>(`
      SELECT moysklad_sync_status, COUNT(*) AS count
      FROM orders
      GROUP BY moysklad_sync_status
      ORDER BY count DESC
    `))

    const kpi = kpiResult.rows[0] || {}
    const periodKpi = periodResult?.rows[0] || {}
    const clients = clientsResult.rows[0] || {}
    const counters = countersResult.rows[0] || {}
    const totalRevenue = Number(kpi.total_revenue) || 0
    const totalOrders = Number(kpi.total_orders) || 0
    // `periodResult` exists only for limited date ranges. For "all" the period
    // is the complete valid-order aggregate calculated above.
    const currentRevenue = days === null
      ? totalRevenue
      : Number(periodKpi.current_revenue) || 0
    const previousRevenue = Number(periodKpi.previous_revenue) || 0
    const currentOrders = days === null
      ? Number(kpi.valid_orders) || 0
      : Number(periodKpi.current_orders) || 0
    const previousOrders = Number(periodKpi.previous_orders) || 0
    const revenueTrend = days === null
      ? null
      : previousRevenue === 0
        ? currentRevenue > 0 ? 100 : 0
        : Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
    const ordersTrend = days === null
      ? null
      : previousOrders === 0
        ? currentOrders > 0 ? 100 : 0
        : Math.round(((currentOrders - previousOrders) / previousOrders) * 100)

    return Response.json({
      period,
      generatedAt: now.toISOString(),
      metrics: {
        totalOrders,
        validOrders: Number(kpi.valid_orders) || 0,
        totalRevenue: Math.round(totalRevenue),
        avgOrder: Math.round((Number(kpi.avg_order) || 0)),
        totalClients: Number(clients.total_clients) || 0,
        newClients: Number(clients.new_clients) || 0,
        pendingReviews: Number(counters.pending_reviews) || 0,
        pendingPriceRequests: Number(counters.pending_price_requests) || 0,
        activePromos: Number(counters.active_promos) || 0,
        promoUses: Number(counters.promo_uses) || 0,
        visibleProducts: Number(counters.visible_products) || 0,
        periodRevenue: Math.round(currentRevenue),
        previousRevenue: Math.round(previousRevenue),
        periodOrders: currentOrders,
        previousOrders,
        revenueTrend,
        ordersTrend,
      },
      timeline: {
        granularity: days ? "day" : "month",
        points: timelineResult.rows.map((point) => ({
          date: new Date(point.bucket).toISOString(),
          orders: Number(point.orders) || 0,
          revenue: Number(point.revenue) || 0,
        })),
      },
      statuses: statusResult.rows.map((row) => ({
        value: row.value,
        count: Number(row.count) || 0,
        share: totalOrders > 0 ? Math.round(((Number(row.count) || 0) / totalOrders) * 100) : 0,
      })),
      payments: paymentResult.rows.map((row) => ({
        value: row.value,
        count: Number(row.count) || 0,
        share: totalOrders > 0 ? Math.round(((Number(row.count) || 0) / totalOrders) * 100) : 0,
      })),
      customerTypes: customerTypeResult.rows.map((row) => ({
        value: row.value,
        count: Number(row.count) || 0,
        revenue: Math.round(Number(row.revenue) || 0),
      })),
      deliveries: deliveryResult.rows.map((row) => ({
        value: row.value,
        count: Number(row.count) || 0,
      })),
      topProducts: topProductsResult.rows.map((product) => ({
        name: product.name,
        qty: Number(product.qty) || 0,
        revenue: Math.round(Number(product.revenue) || 0),
        orders: Number(product.orders) || 0,
        share: currentRevenue > 0 ? Math.round(((Number(product.revenue) || 0) / currentRevenue) * 100) : 0,
      })),
      topClients: topClientsResult.rows.map((client) => ({
        name: client.name,
        payloadId: client.payload_id == null ? undefined : String(client.payload_id),
        email: client.email || undefined,
        orders: Number(client.orders) || 0,
        revenue: Math.round(Number(client.revenue) || 0),
      })),
      recentOrders: recentResult.rows.map((order) => ({
        id: String(order.id),
        orderId: order.order_id || `#${order.id}`,
        customer: order.customer,
        customerType: order.customer_type,
        status: order.status,
        paymentStatus: order.payment_status,
        total: Math.round(Number(order.total) || 0),
        createdAt: new Date(order.created_at).toISOString(),
      })),
      moysklad: moyskladResult.rows.map((row) => ({
        value: row.moysklad_sync_status,
        count: Number(row.count) || 0,
      })),
    })
  } catch (error) {
    console.error("[business-dashboard] failed", error)
    return Response.json({ error: "Не удалось загрузить дашборд. Подробности записаны в журнал сервера." }, { status: 500 })
  }
}
