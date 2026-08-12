import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@payload-config"
import { createYooKassaPayment, getYooKassaPayment } from "@/lib/payments/yookassa"
import { verifyOrderPaymentToken } from "@/lib/payments/order-payment-token"
import { sendPaidOrderConfirmation } from "@/lib/payments/paid-order-email"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { token?: string } | null
  const orderId = body?.token ? verifyOrderPaymentToken(body.token) : null
  if (!orderId) return NextResponse.json({ ok: false, error: "Ссылка на оплату недействительна" }, { status: 401 })

  const payload = await getPayload({ config })
  const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
  if (!order || order.paymentMethod !== "yookassa") return NextResponse.json({ ok: false, error: "Заказ не найден" }, { status: 404 })
  if (order.paymentStatus === "paid") {
    const email = await sendPaidOrderConfirmation(payload, order.id)
    if (!email.sent) console.error(`[Order ${order.orderId || order.id}] Не отправлено письмо об оплате: ${email.error}`)
    return NextResponse.json({ ok: true, status: "paid" })
  }

  if (order.paymentExternalId) {
    const current = await getYooKassaPayment(order.paymentExternalId)
    if (!current.ok) {
      return NextResponse.json({ ok: false, error: "Не удалось проверить текущий платёж. Попробуйте ещё раз через минуту." }, { status: 502 })
    }
    if (current.ok && current.status === "paid") {
      await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: "paid", paymentUpdatedAt: new Date().toISOString() }, overrideAccess: true })
      const email = await sendPaidOrderConfirmation(payload, order.id)
      if (!email.sent) console.error(`[Order ${order.orderId || order.id}] Не отправлено письмо об оплате: ${email.error}`)
      return NextResponse.json({ ok: true, status: "paid" })
    }
    if (current.status === "pending") {
      const paymentUrl = current.paymentUrl || order.paymentUrl
      if (!paymentUrl) {
        return NextResponse.json({ ok: false, error: "YooKassa не вернула ссылку текущего платежа" }, { status: 502 })
      }
      if (paymentUrl !== order.paymentUrl) {
        await payload.update({ collection: "orders", id: order.id, data: { paymentUrl }, overrideAccess: true })
      }
      return NextResponse.json({ ok: true, status: "pending", paymentUrl })
    }
  }

  const payment = await createYooKassaPayment({
    orderId: String(order.id),
    orderNumber: order.orderId || String(order.id),
    amountRubles: Number(order.total || 0),
    description: `Заказ ${order.orderId || order.id} в 10coffee`,
    // A cancelled payment is the idempotent parent of exactly one retry payment.
    // Concurrent clicks or a failed DB update therefore cannot create duplicates.
    attemptKey: `retry:${order.paymentExternalId || "initial"}`,
  })
  if (!payment.ok) return NextResponse.json({ ok: false, error: payment.error }, { status: 502 })

  await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      paymentStatus: "pending",
      paymentExternalId: payment.paymentId,
      paymentUrl: payment.paymentUrl,
      paymentUpdatedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, status: "pending", paymentUrl: payment.paymentUrl })
}
