import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@payload-config"
import { verifyOrderPaymentToken } from "@/lib/payments/order-payment-token"
import { refreshYooKassaOrderPayment } from "@/lib/payments/yookassa-order-status"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
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

    // Refresh once before closing the local order so an already completed
    // payment can never be mistaken for an abandoned one. A still-pending
    // YooKassa payment does not need to block the customer's cart: a later
    // succeeded webhook remains authoritative and reopens the order as paid.
    if (order.paymentExternalId && order.paymentStatus === "pending") {
      const refreshed = await refreshYooKassaOrderPayment(order.paymentExternalId, "payment")
      if (!refreshed.ok) return NextResponse.json({ ok: false, error: refreshed.error }, { status: 502 })
      if (refreshed.status === "paid") {
        return NextResponse.json({ ok: false, error: "Платёж уже прошёл. Корзина будет очищена после обновления статуса." }, { status: 409 })
      }
      order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
    }

    await payload.update({
      collection: "orders",
      id: order.id,
      data: {
        status: "cancelled",
        ...(!order.paymentExternalId ? { paymentStatus: "cancelled" as const } : {}),
      },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, status: "cancelled" })
  } catch (error) {
    console.error("[YooKassa abandon] Не удалось закрыть неоплаченный заказ", error)
    return NextResponse.json({ ok: false, error: "Не удалось закрыть неоплаченный заказ" }, { status: 500 })
  }
}
