import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@payload-config"
import { verifyOrderPaymentToken } from "@/lib/payments/order-payment-token"
import { refreshYooKassaOrderPayment } from "@/lib/payments/yookassa-order-status"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: string } | null
  const orderId = body?.token ? verifyOrderPaymentToken(body.token) : null
  if (!orderId) return NextResponse.json({ ok: false, error: "Ссылка на оплату недействительна" }, { status: 401 })

  const payload = await getPayload({ config })
  const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
  if (!order || order.paymentMethod !== "yookassa") return NextResponse.json({ ok: false, error: "Заказ не найден" }, { status: 404 })
  if (order.paymentStatus === "paid") return NextResponse.json({ ok: true, status: "paid" })
  // An administrator may close an unpaid order by its business status while
  // the remote payment is still pending. The cart must be released locally;
  // a later authoritative YooKassa webhook can still restore a successful
  // payment without keeping the customer's checkout locked in the meantime.
  if (order.status === "cancelled") return NextResponse.json({ ok: true, status: "cancelled" })
  // A terminal status set by an administrator is the local signal that the
  // pending-order card may be removed. Do not immediately overwrite it with
  // the still-pending remote status. YooKassa webhooks remain authoritative
  // and can restore a late successful payment as `paid`.
  if (["cancelled", "failed", "refunded"].includes(order.paymentStatus || "")) {
    return NextResponse.json({ ok: true, status: order.paymentStatus })
  }
  if (!order.paymentExternalId) return NextResponse.json({ ok: true, status: order.paymentStatus || "pending" })

  const refreshed = await refreshYooKassaOrderPayment(order.paymentExternalId, "payment")
  if (!refreshed.ok) return NextResponse.json({ ok: false, error: refreshed.error }, { status: 502 })
  return NextResponse.json({ ok: true, status: refreshed.status })
}
