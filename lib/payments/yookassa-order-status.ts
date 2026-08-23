import { getPayload } from "payload"
import config from "@payload-config"
import { getYooKassaPayment } from "@/lib/payments/yookassa"
import { sendPaidOrderConfirmation } from "@/lib/payments/paid-order-email"
import { syncOrderToMoyskladById } from "@/lib/moysklad/order-retry"
import { finalizeLoyaltyForPaidOrder, releaseLoyaltyReservation } from "@/lib/loyalty"
import { createYandexDeliveryRequestForPaidOrder } from "@/lib/yandex-delivery"
import { getPool } from "@/lib/db"

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
  const paymentIsTerminalFailure = ["cancelled", "failed"].includes(payment.status)
  await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      paymentStatus: payment.status,
      paymentUpdatedAt: new Date().toISOString(),
      ...(paymentIsTerminalFailure ? { status: "cancelled" } : {}),
    },
    overrideAccess: true,
  })
  if (payment.status === "paid") await finalizeLoyaltyForPaidOrder(payload, order as unknown as Record<string, unknown>)
  if (["cancelled", "failed", "refunded"].includes(payment.status)) await releaseLoyaltyReservation(payload, order.id)
  let yandexDeliveryCreated: boolean | null = null
  let yandexDeliveryError: string | null = null
  if (payment.status === "paid" && order.deliveryMethod === "yandex_delivery" && !order.yandexRequestId) {
    const client = await getPool().connect()
    const lockKey = `yandex-delivery:${order.id}`
    try {
      // A webhook and the return page can reach this code at the same time.
      // Hold a per-order lock until the external request ID is persisted.
      await client.query("select pg_advisory_lock(hashtext($1))", [lockKey])
      const current = await client.query<{ yandex_request_id: string | null }>(
        "select yandex_request_id from orders where id = $1",
        [order.id],
      )
      if (!current.rows[0]?.yandex_request_id) {
        const yandex = await createYandexDeliveryRequestForPaidOrder(order)
        if (!yandex.skipped && yandex.requestId) {
          await payload.update({
            collection: "orders",
            id: order.id,
            data: { yandexRequestId: yandex.requestId, yandexDeliveryStatus: "Заявка создана" },
            overrideAccess: true,
          })
          yandexDeliveryCreated = true
        }
      }
    } catch (error) {
      yandexDeliveryCreated = false
      yandexDeliveryError = error instanceof Error ? error.message : "Не удалось создать заявку Яндекс Доставки"
      await payload.update({
        collection: "orders",
        id: order.id,
        data: { yandexDeliveryStatus: `Ошибка: ${yandexDeliveryError}`.slice(0, 500) },
        overrideAccess: true,
      })
      console.error(`[Order ${order.orderId || order.id}] Не удалось создать заявку Яндекс Доставки: ${yandexDeliveryError}`)
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined)
      client.release()
    }
  }
  let moyskladSynced: boolean | null = null
  let moyskladError: string | null = null
  if (payment.status === "paid" && (order.moyskladSyncStatus !== "synced" || !order.moyskladCustomerOrderId)) {
    try {
      const sync = await syncOrderToMoyskladById(payload, order.id)
      if ("error" in sync && sync.error) {
        moyskladSynced = false
        moyskladError = sync.error
        console.error(`[Order ${order.orderId || order.id}] Не удалось выгрузить оплаченный заказ в МойСклад: ${sync.error}`)
      } else if ("skipped" in sync && sync.skipped) {
        moyskladSynced = null
      } else {
        moyskladSynced = true
      }
    } catch (error) {
      moyskladSynced = false
      moyskladError = error instanceof Error ? error.message : "Не удалось выгрузить оплаченный заказ в МойСклад"
      console.error(`[Order ${order.orderId || order.id}] Не удалось выгрузить оплаченный заказ в МойСклад: ${moyskladError}`)
    }
  }
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
    moyskladSynced,
    moyskladError,
    yandexDeliveryCreated,
    yandexDeliveryError,
  }
}

export async function reconcilePendingYooKassaPayments() {
  const payload = await getPayload({ config })
  const paymentIds: string[] = []
  let page = 1
  while (true) {
    const orders = await payload.find({
      collection: "orders",
      where: {
        and: [
          { paymentMethod: { equals: "yookassa" } },
          { paymentStatus: { equals: "pending" } },
          { paymentExternalId: { exists: true } },
        ],
      },
      limit: 200,
      page,
      depth: 0,
      overrideAccess: true,
    })
    for (const order of orders.docs) {
      if (order.paymentExternalId) paymentIds.push(order.paymentExternalId)
    }
    if (!orders.hasNextPage) break
    page = orders.nextPage || page + 1
  }

  let updated = 0
  const errors: string[] = []
  for (const paymentId of paymentIds) {
    const result = await refreshYooKassaOrderPayment(paymentId, "payment")
    if (result.ok) {
      if (result.status !== "pending") updated += 1
    } else {
      errors.push(`${paymentId}: ${result.error}`)
    }
  }
  return { checked: paymentIds.length, updated, errors }
}
