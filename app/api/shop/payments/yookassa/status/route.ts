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
  if (!order.paymentExternalId) return NextResponse.json({ ok: true, status: order.paymentStatus || "pending" })

  const refreshed = await refreshYooKassaOrderPayment(order.paymentExternalId, "payment")
  if (!refreshed.ok) return NextResponse.json({ ok: false, error: refreshed.error }, { status: 502 })
  return NextResponse.json({ ok: true, status: refreshed.status })
}
