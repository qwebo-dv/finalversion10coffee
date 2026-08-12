import { getPayload } from "payload"
import config from "@payload-config"
import { getYooKassaPayment } from "@/lib/payments/yookassa"
import { sendPaidOrderConfirmation } from "@/lib/payments/paid-order-email"

export async function refreshYooKassaOrderPayment(reference: string, referenceKind: "order" | "payment" = "payment") {
  const normalized = reference.trim()
  if (!normalized) return { ok: false as const, error: "Не указан ID заказа или платежа" }
  const payload = await getPayload({ config })
  const orders = await payload.find({
    collection: "orders",
    where: referenceKind === "payment" ? { paymentExternalId: { equals: normalized } } : { or: [{ id: { equals: normalized } }, { orderId: { equals: normalized } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const order = orders.docs[0]
  if (!order || !order.paymentExternalId) return { ok: false as const, error: "Заказ для платежа не найден" }
  const payment = await getYooKassaPayment(order.paymentExternalId)
  if (!payment.ok) return payment
  if (payment.paymentId !== order.paymentExternalId || (payment.orderId && String(payment.orderId) !== String(order.id))) return { ok: false as const, error: "Платёж не принадлежит этому заказу" }
  if (!Number.isFinite(payment.amountRubles) || Math.abs(payment.amountRubles - Number(order.total || 0)) > 0.01) return { ok: false as const, error: "Сумма платежа не совпадает с суммой заказа" }
  await payload.update({ collection: "orders", id: order.id, data: { paymentStatus: payment.status, paymentUpdatedAt: new Date().toISOString() }, overrideAccess: true })
  const email = payment.status === "paid"
    ? await sendPaidOrderConfirmation(payload, order.id)
    : null
  if (email && !email.sent) {
    console.error(`[Order ${order.orderId || order.id}] Не отправлено письмо об оплате: ${email.error}`)
  }
  return {
    ok: true as const,
    orderId: order.id,
    orderNumber: order.orderId,
    status: payment.status,
    confirmationEmailSent: email?.sent ?? null,
  }
}
