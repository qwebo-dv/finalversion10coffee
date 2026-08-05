import { getPayload } from "payload"
import config from "@payload-config"
import { getSberPaymentStatus } from "@/lib/payments/sber"

export async function refreshSberOrderPayment(paymentId: string) {
  const normalizedPaymentId = paymentId.trim()
  if (!normalizedPaymentId) {
    return { ok: false as const, error: "Не указан ID платежа" }
  }

  const payload = await getPayload({ config })
  const orders = await payload.find({
    collection: "orders",
    where: { paymentExternalId: { equals: normalizedPaymentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const order = orders.docs[0]
  if (!order) {
    return { ok: false as const, error: "Заказ для платежа не найден" }
  }

  const payment = await getSberPaymentStatus(normalizedPaymentId)
  if (!payment.ok) return payment

  if (
    typeof payment.amountRubles === "number" &&
    Math.abs(payment.amountRubles - Number(order.total || 0)) > 0.01
  ) {
    return { ok: false as const, error: "Сумма платежа не совпадает с суммой заказа" }
  }

  await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      paymentStatus: payment.status,
      paymentUpdatedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  return {
    ok: true as const,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: payment.status,
  }
}
