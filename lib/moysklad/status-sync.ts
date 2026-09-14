import type { Payload } from "payload"
import { getMoyskladConfig } from "./config"
import { moyskladRequest } from "./client"
import { writeMoyskladLog } from "./logs"
import { createAdminClient } from "@/lib/supabase/admin"
import type { MoyskladCustomerOrder } from "./types"
import type { OrderStatus } from "@/types"

type PaymentStatus = "pending" | "invoiced" | "partial" | "paid" | "refunded"

interface PayloadClientForStatus {
  id?: string | number
  supabaseId?: string | null
}

interface PayloadOrderForStatus {
  id: string | number
  orderId?: string
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  moyskladCustomerOrderId?: string | null
  client?: PayloadClientForStatus | string | number | null
}

interface SyncOrderStatusOptions {
  limit?: number
}

interface SyncedOrderStatus {
  id: string | number
  orderId?: string
  moyskladCustomerOrderId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  moyskladState?: string | null
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтвержден",
  invoiced: "Счет выставлен",
  paid: "Оплачен",
  in_production: "В производстве",
  ready: "Собран",
  shipped: "Отгружен",
  delivered: "Доставлен",
  returned: "Возврат",
  cancelled: "Отменен",
}

function normalizeStateName(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/ё/g, "е")
}

export function mapMoyskladStateToOrderStatus(stateName?: string | null): OrderStatus {
  const state = normalizeStateName(stateName)

  if (!state) return "new"
  if (state.includes("отмен")) return "cancelled"
  if (state.includes("возврат")) return "returned"
  if (state.includes("собран")) return "ready"
  if (state.includes("достав")) return "delivered"
  if (state.includes("отгруж")) return "shipped"
  if (state.includes("готов")) return "ready"
  if (state.includes("производ")) return "in_production"
  if (state.includes("оплачен")) return "paid"
  if (state.includes("счет") || state.includes("счёт")) return "invoiced"
  if (state.includes("подтверж")) return "confirmed"
  if (state.includes("нов")) return "new"

  return "new"
}

async function notifyClientAboutStatus(order: PayloadOrderForStatus, status: OrderStatus) {
  const client = order.client
  const clientId = typeof client === "object" && client !== null ? client.supabaseId : null
  if (!clientId) return

  const orderDisplayId = order.orderId || String(order.id)
  const statusLabel = STATUS_LABELS[status] || status
  const adminDb = createAdminClient()

  const { error } = await adminDb.from("notifications").insert({
    client_id: clientId,
    type: "order_update",
    title: "Статус заказа изменен",
    message: `Заказ ${orderDisplayId}: ${statusLabel}`,
    data: {
      order_id: String(order.id),
      status,
      source: "moysklad",
    },
  })

  if (error) {
    throw new Error(`Не удалось создать уведомление о статусе: ${error.message}`)
  }
}

function mapMoyskladPaymentStatus(order: MoyskladCustomerOrder, status: OrderStatus): PaymentStatus {
  const sum = Number(order.sum) || 0
  const payedSum = Number(order.payedSum) || 0
  const invoicedSum = Number(order.invoicedSum) || 0

  if (sum > 0 && payedSum >= sum) return "paid"
  if (payedSum > 0) return "partial"
  if (invoicedSum > 0) return "invoiced"
  if (status === "invoiced") return "invoiced"

  return "pending"
}

async function fetchMoyskladOrder(id: string) {
  return moyskladRequest<MoyskladCustomerOrder>(`entity/customerorder/${id}?expand=state`)
}

export async function syncMoyskladOrderStatuses(
  payload: Payload,
  options: SyncOrderStatusOptions = {}
) {
  const config = getMoyskladConfig()
  if (!config.enabled) {
    return { ok: false as const, error: "MOYSKLAD_ENABLED не включен" }
  }

  const limit = options.limit || 200
  const result = await payload.find({
    collection: "orders",
    sort: "-createdAt",
    limit,
    depth: 1,
    overrideAccess: true,
  })

  const orders = (result.docs as PayloadOrderForStatus[])
    .filter((order) => Boolean(order.moyskladCustomerOrderId))

  const synced: SyncedOrderStatus[] = []
  const errors: { id: string | number; orderId?: string; error: string }[] = []

  for (const order of orders) {
    const moyskladCustomerOrderId = order.moyskladCustomerOrderId
    if (!moyskladCustomerOrderId) continue

    try {
      const moyskladOrder = await fetchMoyskladOrder(moyskladCustomerOrderId)
      const nextStatus = mapMoyskladStateToOrderStatus(moyskladOrder.state?.name)
      const nextPaymentStatus = mapMoyskladPaymentStatus(moyskladOrder, nextStatus)
      const statusChanged = nextStatus !== order.status

      await payload.update({
        collection: "orders",
        id: order.id,
        data: {
          status: nextStatus,
          paymentStatus: nextPaymentStatus,
          moyskladSyncStatus: "synced",
          moyskladSyncError: "",
          moyskladSyncedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })

      if (statusChanged) {
        try {
          await notifyClientAboutStatus(order, nextStatus)
        } catch (notificationError) {
          await writeMoyskladLog({
            entityType: "order_status",
            localId: order.id,
            moyskladId: moyskladCustomerOrderId,
            direction: "moysklad_to_site",
            status: "error",
            message: notificationError instanceof Error
              ? notificationError.message
              : "Не удалось создать уведомление о статусе",
          })
        }
      }

      synced.push({
        id: order.id,
        orderId: order.orderId,
        moyskladCustomerOrderId,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        moyskladState: moyskladOrder.state?.name || null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось синхронизировать статус заказа"
      errors.push({ id: order.id, orderId: order.orderId, error: message })

      await payload.update({
        collection: "orders",
        id: order.id,
        data: {
          moyskladSyncStatus: "error",
          moyskladSyncError: message,
        },
        overrideAccess: true,
      })

      await writeMoyskladLog({
        entityType: "order_status",
        localId: order.id,
        moyskladId: moyskladCustomerOrderId,
        direction: "moysklad_to_site",
        status: "error",
        message,
      })
    }
  }

  if (synced.length > 0) {
    await writeMoyskladLog({
      entityType: "order_status",
      direction: "moysklad_to_site",
      status: "success",
      message: `Синхронизировано статусов заказов: ${synced.length}`,
      response: synced,
    })
  }

  return {
    ok: errors.length === 0,
    checked: orders.length,
    synced: synced.length,
    errors,
    orders: synced,
  }
}
