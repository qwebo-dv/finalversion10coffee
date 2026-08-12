import type { Payload } from "payload"
import { getPool } from "@/lib/db"

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character)
}

/**
 * Sends the retail payment confirmation exactly once per order.
 * A PostgreSQL advisory lock serializes the YooKassa webhook and return page,
 * while the persisted timestamp keeps later webhook retries idempotent.
 */
export async function sendPaidOrderConfirmation(payload: Payload, orderId: string | number) {
  const client = await getPool().connect()
  const lockKey = `paid-order-email:${orderId}`

  try {
    await client.query("select pg_advisory_lock(hashtext($1))", [lockKey])
    const result = await client.query<{ payment_confirmation_email_sent_at: Date | null }>(
      "select payment_confirmation_email_sent_at from orders where id = $1",
      [orderId],
    )
    if (result.rows[0]?.payment_confirmation_email_sent_at) {
      return { sent: true as const, alreadySent: true as const }
    }

    const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
    if (order.paymentStatus !== "paid" || order.paymentMethod !== "yookassa" || !order.customerEmail) {
      return { sent: false as const, error: "Заказ не готов к подтверждению оплаты" }
    }

    const orderNumber = order.orderId || String(order.id)
    await payload.sendEmail({
      to: order.customerEmail,
      subject: `Заказ ${orderNumber} оплачен`,
      html: `<p>Здравствуйте, ${escapeHtml(order.customerFullName)}!</p><p>Оплата заказа <strong>${escapeHtml(orderNumber)}</strong> на сумму ${Number(order.total || 0).toLocaleString("ru-RU")} ₽ успешно получена.</p><p>Заказ передан в обработку.</p>`,
    })
    const sentAt = new Date().toISOString()
    await client.query(
      "update orders set payment_confirmation_email_sent_at = $1, updated_at = now() where id = $2",
      [sentAt, orderId],
    )
    return { sent: true as const, alreadySent: false as const }
  } catch (error) {
    return {
      sent: false as const,
      error: error instanceof Error ? error.message : "Не удалось отправить подтверждение оплаты",
    }
  } finally {
    await client.query("select pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined)
    client.release()
  }
}
