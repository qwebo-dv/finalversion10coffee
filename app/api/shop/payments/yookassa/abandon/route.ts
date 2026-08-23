import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@payload-config"
import { verifyOrderPaymentToken } from "@/lib/payments/order-payment-token"
import { refreshYooKassaOrderPayment } from "@/lib/payments/yookassa-order-status"
import { releaseLoyaltyReservation } from "@/lib/loyalty"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: string } | null
  const orderId = body?.token ? verifyOrderPaymentToken(body.token) : null
  if (!orderId) return NextResponse.json({ ok: false, error: "Ссылка на оплату недействительна" }, { status: 401 })

  const payload = await getPayload({ config })
  let order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
  if (!order || order.paymentMethod !== "yookassa") {
    return NextResponse.json({ ok: false, error: "Заказ не найден" }, { status: 404 })
  }
  if (order.paymentStatus === "paid") {
    return NextResponse.json({ ok: false, error: "Заказ уже оплачен. Отменить его можно только через менеджера с оформлением возврата." }, { status: 409 })
  }

  if (order.paymentExternalId && order.paymentStatus === "pending") {
    const refreshed = await refreshYooKassaOrderPayment(order.paymentExternalId, "payment")
    if (!refreshed.ok) return NextResponse.json({ ok: false, error: refreshed.error }, { status: 502 })
    if (refreshed.status === "paid") {
      return NextResponse.json({ ok: false, error: "Платёж уже прошёл. Корзина будет очищена после обновления статуса." }, { status: 409 })
    }
    if (refreshed.status === "pending") {
      return NextResponse.json({
        ok: false,
        error: "Платёж ещё ожидает завершения в YooKassa. Пока он активен, безопасно отменить заказ нельзя — попробуйте позже.",
      }, { status: 409 })
    }
    order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
  }

  if (!["cancelled", "failed", "refunded"].includes(order.paymentStatus || "") && order.paymentExternalId) {
    return NextResponse.json({ ok: false, error: "Статус платежа пока не позволяет отменить заказ" }, { status: 409 })
  }

  await releaseLoyaltyReservation(payload, order.id)
  await payload.update({
    collection: "orders",
    id: order.id,
    data: { status: "cancelled", ...(order.paymentExternalId ? {} : { paymentStatus: "cancelled" }) },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, status: "cancelled" })
}
