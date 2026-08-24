import "server-only"

import type { Payload } from "payload"
import { CDEK_TRACKING_URL } from "@/lib/utils/cdek-tracking"

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character)
}

export async function sendCdekTrackingEmail(payload: Payload, order: {
  id: string | number
  orderId?: string | null
  customerEmail?: string | null
  customerFullName?: string | null
  cdekTrackingNumber?: string | null
}) {
  try {
    const trackingNumber = String(order.cdekTrackingNumber || "").trim()
    if (!trackingNumber || !order.customerEmail) {
      return { sent: false as const, error: "В заказе нет данных для уведомления СДЭК" }
    }

    const orderNumber = order.orderId || String(order.id)
    await payload.sendEmail({
      to: order.customerEmail,
      subject: `Заказ ${orderNumber}: отправление передано в СДЭК`,
      html: `<p>Здравствуйте, ${escapeHtml(order.customerFullName)}!</p><p>Для заказа <strong>${escapeHtml(orderNumber)}</strong> назначен номер отслеживания СДЭК:</p><p style="font-size:20px"><strong>${escapeHtml(trackingNumber)}</strong></p><p><a href="${CDEK_TRACKING_URL}" target="_blank" rel="noopener noreferrer">Отследить отправление на официальном сайте СДЭК</a></p><p>Если номер ещё не найден, попробуйте проверить его позже: информация появляется после обработки отправления службой доставки.</p>`,
    })
    return { sent: true as const }
  } catch (error) {
    return {
      sent: false as const,
      error: error instanceof Error ? error.message : "Не удалось отправить трек-номер СДЭК",
    }
  }
}
