import type { Endpoint, PayloadRequest } from "payload"
import { dbReadQuery } from "@/lib/db"
import { canManageContent, canReadOperations, getAllowedSalesChannels } from "../access/adminRoles"
import { resolveAdminWorkspace } from "../admin/workspace"

interface CountRow {
  count: string | number
}

function parseSeenAt(req: Pick<PayloadRequest, "url">, parameter: string): Date | null {
  const value = new URL(req.url || "http://payload.local", "http://payload.local").searchParams.get(parameter)
  if (!value || value.length > 64) return null

  const seenAt = new Date(value)
  return Number.isNaN(seenAt.getTime()) ? null : seenAt
}

function formatCount(row?: CountRow): number {
  const count = Number(row?.count)
  return Number.isFinite(count) && count > 0 ? count : 0
}

/**
 * Returns only aggregate counts for collections the current administrator can
 * already access. The individual read markers stay in Payload preferences.
 */
export const adminUnreadCountsHandler: Endpoint["handler"] = async (req) => {
  const canReadOrders = canReadOperations(req.user) && getAllowedSalesChannels(req.user).length > 0
  const canReadFaqs = canManageContent(req.user)

  if (!canReadOrders && !canReadFaqs) {
    return Response.json({ error: "Недостаточно прав для просмотра уведомлений" }, { status: 403 })
  }

  const ordersSeenAt = parseSeenAt(req, "ordersSeenAt")
  const faqsSeenAt = parseSeenAt(req, "faqsSeenAt")

  try {
    const workspace = resolveAdminWorkspace(req)
    const orderWhere = workspace === "retail"
      ? "sales_channel = 'retail' AND payment_status IN ('paid', 'refunded')"
      : workspace === "wholesale"
        ? "sales_channel = 'wholesale'"
        : "(sales_channel = 'wholesale' OR (sales_channel = 'retail' AND payment_status IN ('paid', 'refunded')))"

    const orderParams: Date[] = []
    const orderSince = ordersSeenAt
      ? (() => {
          orderParams.push(ordersSeenAt)
          return " AND created_at > $1"
        })()
      : ""
    const faqParams: Date[] = []
    const faqSince = faqsSeenAt
      ? (() => {
          faqParams.push(faqsSeenAt)
          return " AND created_at > $1"
        })()
      : ""

    const [ordersResult, faqsResult] = await Promise.all([
      canReadOrders
        ? dbReadQuery<CountRow>(`SELECT COUNT(*) AS count FROM orders WHERE ${orderWhere}${orderSince}`, orderParams)
        : Promise.resolve({ rows: [] as CountRow[] }),
      canReadFaqs
        ? dbReadQuery<CountRow>(
            `SELECT COUNT(*) AS count FROM faqs WHERE source = 'website' AND status = 'pending'${faqSince}`,
            faqParams,
          )
        : Promise.resolve({ rows: [] as CountRow[] }),
    ])

    return Response.json({
      orders: formatCount(ordersResult.rows[0]),
      faqs: formatCount(faqsResult.rows[0]),
    })
  } catch (error) {
    console.error("[admin-unread-counts] failed to load notification counts", error)
    return Response.json({ error: "Не удалось загрузить уведомления" }, { status: 500 })
  }
}
