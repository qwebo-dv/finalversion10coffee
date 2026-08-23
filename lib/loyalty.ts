import type { Payload, Where } from "payload"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPool } from "@/lib/db"
import { listSocialIdentityRecords } from "@/lib/auth/local"

type Id = string | number
type Operation = { id: number; client?: number | { id?: number }; amount?: number | null; status?: string | null; expiresAt?: string | null; type?: string | null }
type Settings = { enabled?: boolean; expiryDays?: number; balanceCap?: number; maxRedemptionPercent?: number; tiers?: { minSubtotal?: number; percent?: number }[] }

export type LoyaltySnapshot = { enabled: boolean; balance: number; reserved: number; available: number; expiresAt: string | null; maxRedemptionPercent: number }

function asId(value: unknown): string { return String(typeof value === "object" && value !== null ? (value as { id?: Id }).id || "" : value || "") }
function asRelationshipId(value: Id): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Некорректный Payload ID: ${value}`)
  return id
}
function isCustomerEmail(value: unknown): value is string { return typeof value === "string" && /@/.test(value) && !value.endsWith("@auth.10coffee.local") }
function daysLabel(days: number) { return days === 1 ? "день" : days >= 2 && days <= 4 ? "дня" : "дней" }

type LoyaltyNotification = {
  key: string
  title: string
  message: string
  data: Record<string, string | number>
}

async function withLoyaltyClientLock<T>(clientId: Id, operation: () => Promise<T>): Promise<T> {
  const normalizedClientId = asRelationshipId(clientId)
  const connection = await getPool().connect()
  const lockKey = `loyalty-client:${normalizedClientId}`
  try {
    await connection.query("select pg_advisory_lock(hashtext($1))", [lockKey])
    return await operation()
  } finally {
    await connection.query("select pg_advisory_unlock(hashtext($1))", [lockKey]).catch(() => undefined)
    connection.release()
  }
}

async function findAllLoyaltyOperations(payload: Payload, where: Where): Promise<Operation[]> {
  const docs: Operation[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: "loyalty-operations",
      where,
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
    })
    docs.push(...result.docs as unknown as Operation[])
    if (!result.hasNextPage) break
    page = result.nextPage || page + 1
  }
  return docs
}

async function claimDelivery(notificationKey: string, clientId: Id, channel: "internal" | "email" | "telegram" | "vk") {
  try {
    const { rows } = await getPool().query<{ id: number }>(
      `insert into loyalty_notification_deliveries (notification_key, client_id, channel, status, attempts)
       values ($1, $2, $3, 'pending', 1)
       on conflict (notification_key, channel) do update
         set status = 'pending', attempts = loyalty_notification_deliveries.attempts + 1,
             error = null, updated_at = now()
       where loyalty_notification_deliveries.status = 'failed'
       returning id`,
      [notificationKey, asRelationshipId(clientId), channel],
    )
    return rows[0]?.id || null
  } catch (error) {
    console.error("[loyalty] Не удалось зарезервировать отправку уведомления", error)
    return null
  }
}

async function finishDelivery(id: number, status: "sent" | "failed", error?: unknown) {
  await getPool().query(
    `update loyalty_notification_deliveries
        set status = $1, error = $2, updated_at = now()
      where id = $3`,
    [status, error instanceof Error ? error.message.slice(0, 1000) : error ? String(error).slice(0, 1000) : null, id],
  ).catch((updateError) => console.error("[loyalty] Не удалось сохранить статус уведомления", updateError))
}

async function sendTelegramMessage(chatId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return false
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  })
  const body = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null
  if (!response.ok || !body?.ok) throw new Error(body?.description || `Telegram API ${response.status}`)
  return true
}

async function sendVkMessage(userId: string, message: string) {
  const token = process.env.VK_COMMUNITY_ACCESS_TOKEN?.trim()
  if (!token) return false
  const params = new URLSearchParams({
    access_token: token,
    v: process.env.VK_API_VERSION?.trim() || "5.199",
    user_id: userId,
    random_id: String(Math.floor(Math.random() * 2_147_483_647) + 1),
    message,
  })
  const response = await fetch("https://api.vk.com/method/messages.send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  })
  const body = await response.json().catch(() => null) as { response?: unknown; error?: { error_msg?: string } } | null
  if (!response.ok || body?.error || body?.response == null) throw new Error(body?.error?.error_msg || `VK API ${response.status}`)
  return true
}

async function notifyLoyaltyClient(payload: Payload, clientId: Id, notification: LoyaltyNotification) {
  try {
    const client = await payload.findByID({ collection: "clients", id: clientId, depth: 0, overrideAccess: true }) as { supabaseId?: string | null; email?: string | null }
    const deliveryText = `${notification.title}. ${notification.message}`

    if (client.supabaseId) {
      const internalDelivery = await claimDelivery(notification.key, clientId, "internal")
      if (internalDelivery) {
        try {
          const { error } = await createAdminClient().from("notifications").insert({
            client_id: client.supabaseId,
            type: "loyalty",
            title: notification.title,
            message: notification.message,
            data: notification.data,
          })
          if (error) throw new Error(error.message)
          await finishDelivery(internalDelivery, "sent")
        } catch (error) {
          await finishDelivery(internalDelivery, "failed", error)
          console.error("[loyalty] Не удалось создать внутреннее уведомление", error)
        }
      }
    }

    if (isCustomerEmail(client.email)) {
      const emailDelivery = await claimDelivery(notification.key, clientId, "email")
      if (emailDelivery) {
        try {
          await payload.sendEmail({
            to: client.email,
            subject: `10coffee — ${notification.title}`,
            html: `<p>${notification.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
          })
          await finishDelivery(emailDelivery, "sent")
        } catch (error) {
          await finishDelivery(emailDelivery, "failed", error)
          console.error("[loyalty] Не удалось отправить email", error)
        }
      }
    }

    if (client.supabaseId) {
      const identities = await listSocialIdentityRecords(client.supabaseId)
      for (const identity of identities) {
        if (identity.provider === "telegram") {
          const delivery = await claimDelivery(notification.key, clientId, "telegram")
          if (!delivery) continue
          try {
            if (!identity.messagingId) throw new Error("Telegram необходимо перепривязать с разрешением на сообщения")
            if (await sendTelegramMessage(identity.messagingId, deliveryText)) await finishDelivery(delivery, "sent")
            else await finishDelivery(delivery, "failed", "TELEGRAM_BOT_TOKEN is not configured")
          } catch (error) {
            await finishDelivery(delivery, "failed", error)
            console.error("[loyalty] Не удалось отправить Telegram-уведомление", error)
          }
        }
        if (identity.provider === "vk") {
          const delivery = await claimDelivery(notification.key, clientId, "vk")
          if (!delivery) continue
          try {
            if (await sendVkMessage(identity.providerUserId, deliveryText)) await finishDelivery(delivery, "sent")
            else await finishDelivery(delivery, "failed", "VK_COMMUNITY_ACCESS_TOKEN is not configured")
          } catch (error) {
            await finishDelivery(delivery, "failed", error)
            console.error("[loyalty] Не удалось отправить VK-уведомление", error)
          }
        }
      }
    }
  } catch (error) {
    console.error("[loyalty] Не удалось подготовить уведомление", error)
  }
}

export async function getLoyaltySettings(payload: Payload): Promise<Required<Omit<Settings, "tiers">> & { tiers: { minSubtotal: number; percent: number }[] }> {
  const settings = await payload.findGlobal({ slug: "loyalty-settings", depth: 0, overrideAccess: true }) as Settings
  return {
    enabled: settings.enabled === true,
    expiryDays: Math.max(1, Number(settings.expiryDays) || 60),
    balanceCap: Math.max(0, Number(settings.balanceCap) || 5000),
    maxRedemptionPercent: Math.min(100, Math.max(0, Number(settings.maxRedemptionPercent) || 20)),
    tiers: (settings.tiers?.length ? settings.tiers : [{ minSubtotal: 0, percent: 3 }, { minSubtotal: 1000, percent: 5 }, { minSubtotal: 5000, percent: 12 }])
      .map((tier) => ({ minSubtotal: Math.max(0, Number(tier.minSubtotal) || 0), percent: Math.max(0, Number(tier.percent) || 0) }))
      .sort((a, b) => a.minSubtotal - b.minSubtotal),
  }
}

export async function getLoyaltySnapshot(payload: Payload, clientId: Id): Promise<LoyaltySnapshot> {
  const settings = await getLoyaltySettings(payload)
  if (!settings.enabled) return { enabled: false, balance: 0, reserved: 0, available: 0, expiresAt: null, maxRedemptionPercent: settings.maxRedemptionPercent }
  const operations = await findAllLoyaltyOperations(payload, { client: { equals: clientId } })
  // Expired source entries remain part of the immutable journal and are offset
  // by a separate expiry operation. Including both preserves correct balances
  // after older points have been partially redeemed.
  const accounting = operations.filter((entry) => entry.status === "active" || entry.status === "expired")
  const balance = Math.max(0, accounting.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0))
  const reserved = Math.max(0, operations.filter((entry) => entry.status === "pending" && entry.type === "reservation").reduce((sum, entry) => sum + Math.abs(Number(entry.amount) || 0), 0))
  const expiries = operations
    .filter((entry) => entry.status === "active" && (entry.type === "accrual" || entry.type === "refund") && Number(entry.amount || 0) > 0)
    .map((entry) => entry.expiresAt)
    .filter((value): value is string => Boolean(value))
    .sort()
  return { enabled: true, balance, reserved, available: Math.max(0, balance - reserved), expiresAt: expiries.at(0) || null, maxRedemptionPercent: settings.maxRedemptionPercent }
}

export async function expireLoyaltyPoints(payload: Payload): Promise<{ expiredClients: number }> {
  const now = new Date().toISOString()
  const due = await findAllLoyaltyOperations(payload, {
    and: [{ status: { equals: "active" } }, { expiresAt: { less_than_equal: now } }],
  })
  const dueByClient = new Map<string, string[]>()
  for (const entry of due) {
    const clientId = asId(entry.client)
    const amount = Number(entry.amount) || 0
    if (!clientId || !entry.expiresAt || amount <= 0) continue
    dueByClient.set(clientId, [...(dueByClient.get(clientId) || []), entry.expiresAt])
  }

  let expiredClients = 0
  for (const [clientId, dueDates] of dueByClient) {
    const latestDueDate = dueDates.sort().at(-1)
    if (!latestDueDate) continue
    const expirationKey = `expiry:${clientId}:${latestDueDate}`
    let amount = 0
    let shouldNotify = false
    await withLoyaltyClientLock(clientId, async () => {
      const operations = await findAllLoyaltyOperations(payload, { client: { equals: clientId } })
      // Do not burn points that are attached to an unfinished payment. The
      // payment reconciliation job will either finalize or release the
      // reservation; the next expiry run can then process this client safely.
      if (operations.some((entry) => entry.type === "reservation" && entry.status === "pending")) return
      const duePositive = operations.filter((entry) => (
        entry.status === "active"
        && (entry.type === "accrual" || entry.type === "refund")
        && Number(entry.amount || 0) > 0
        && Boolean(entry.expiresAt)
        && Date.parse(entry.expiresAt as string) <= Date.parse(now)
      ))
      if (duePositive.length === 0) return

      const accountingBalance = Math.max(0, operations
        .filter((entry) => entry.status === "active" || entry.status === "expired")
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0))
      const futurePositive = operations
        .filter((entry) => (
          entry.status === "active"
          && (entry.type === "accrual" || entry.type === "refund")
          && Number(entry.amount || 0) > 0
          && Boolean(entry.expiresAt)
          && Date.parse(entry.expiresAt as string) > Date.parse(now)
        ))
        .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
      const duePositiveTotal = duePositive.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
      amount = Math.min(duePositiveTotal, Math.max(0, accountingBalance - futurePositive))

      const previous = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: expirationKey } }, limit: 1, depth: 0, overrideAccess: true })
      if (!previous.totalDocs && amount > 0) {
        await payload.create({
          collection: "loyalty-operations",
          data: { client: asRelationshipId(clientId), type: "expiry", amount: -amount, status: "expired", idempotencyKey: expirationKey, note: "Сгорание баллов по окончании срока действия" },
          overrideAccess: true,
        })
      }
      for (const entry of duePositive) {
        await payload.update({ collection: "loyalty-operations", id: entry.id, data: { status: "expired" }, overrideAccess: true })
      }
      shouldNotify = amount > 0
    })

    if (shouldNotify) {
      await notifyLoyaltyClient(payload, clientId, {
        key: expirationKey,
        title: "Баллы сгорели",
        message: `Срок действия ${amount.toLocaleString("ru-RU")} Б закончился.`,
        data: { type: "expiry", amount },
      })
      expiredClients += 1
    }
  }
  return { expiredClients }
}

export async function reserveLoyaltyPoints(payload: Payload, params: { clientId: Id; orderId: Id; amount: number; coffeeSubtotal: number }) {
  const requested = Math.floor(Number(params.amount) || 0)
  if (requested <= 0) return 0
  return withLoyaltyClientLock(params.clientId, async () => {
    const key = `reservation:${params.orderId}`
    const existing = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
    const existingEntry = existing.docs[0] as unknown as Operation | undefined
    if (existingEntry?.status === "pending" && Math.abs(Number(existingEntry.amount) || 0) === requested) return requested
    if (existingEntry) throw new Error("Резерв баллов для этого заказа уже завершён")
    const snapshot = await getLoyaltySnapshot(payload, params.clientId)
    if (!snapshot.enabled) throw new Error("Программа лояльности пока не подключена")
    const maxForOrder = Math.floor(params.coffeeSubtotal * snapshot.maxRedemptionPercent / 100)
    if (requested > maxForOrder) throw new Error(`Максимум для этого заказа: ${maxForOrder} Б (не более ${snapshot.maxRedemptionPercent}% от кофе)`)
    if (requested > snapshot.available) throw new Error("Недостаточно доступных баллов")
    await payload.create({ collection: "loyalty-operations", data: { client: asRelationshipId(params.clientId), order: asRelationshipId(params.orderId), type: "reservation", amount: -requested, status: "pending", idempotencyKey: key, note: "Резерв баллов при оформлении заказа" }, overrideAccess: true })
    return requested
  })
}

export async function finalizeLoyaltyForPaidOrder(payload: Payload, order: Record<string, unknown>) {
  const clientId = asId(order.client)
  const orderId = asId(order.id)
  if (!clientId || !orderId || order.salesChannel !== "retail" || order.customerType !== "individual") return
  await withLoyaltyClientLock(clientId, async () => {
    const settings = await getLoyaltySettings(payload)
    if (!settings.enabled) return
    const redeemed = Math.floor(Number(order.loyaltyPointsRedeemed) || 0)
    if (redeemed <= 0) return
    const key = `redemption:${orderId}`
    const reservation = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: `reservation:${orderId}` } }, limit: 1, depth: 0, overrideAccess: true })
    const entry = reservation.docs[0] as unknown as Operation | undefined
    const redemption = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
    if (redemption.totalDocs) {
      // Recover from a process interruption between creation of the immutable
      // redemption entry and release of its temporary reservation.
      if (entry?.id && entry.status === "pending") {
        await payload.update({ collection: "loyalty-operations", id: entry.id, data: { status: "released" }, overrideAccess: true })
      }
      return
    }
    if (!entry?.id || entry.status !== "pending" || Math.abs(Number(entry.amount) || 0) !== redeemed) {
      throw new Error(`Не найден действующий резерв ${redeemed} Б для оплаченного заказа ${orderId}`)
    }
    await payload.create({ collection: "loyalty-operations", data: { client: asRelationshipId(clientId), order: asRelationshipId(orderId), type: "redemption", amount: -redeemed, status: "active", idempotencyKey: key, note: "Списание баллов за заказ" }, overrideAccess: true })
    await payload.update({ collection: "loyalty-operations", id: entry.id, data: { status: "released" }, overrideAccess: true })
  })
}

export async function releaseLoyaltyReservation(payload: Payload, orderId: Id) {
  const reservation = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: `reservation:${orderId}` } }, limit: 1, depth: 0, overrideAccess: true })
  const entry = reservation.docs[0] as unknown as Operation | undefined
  const clientId = asId(entry?.client)
  if (!entry?.id || !clientId) return
  await withLoyaltyClientLock(clientId, async () => {
    const current = await payload.findByID({ collection: "loyalty-operations", id: entry.id, depth: 0, overrideAccess: true }) as unknown as Operation
    if (current.status === "pending") {
      await payload.update({ collection: "loyalty-operations", id: current.id, data: { status: "released" }, overrideAccess: true })
    }
  })
}

export async function accrueLoyaltyForDeliveredOrder(payload: Payload, order: Record<string, unknown>) {
  const clientId = asId(order.client); const orderId = asId(order.id)
  const orderNumber = String(order.orderId || orderId)
  if (
    !clientId
    || !orderId
    || order.salesChannel !== "retail"
    || order.customerType !== "individual"
    || order.status !== "delivered"
    || order.paymentStatus !== "paid"
  ) return
  const settings = await getLoyaltySettings(payload); if (!settings.enabled) return
  const moneyPaidForGoods = Math.max(0, Number(order.subtotal || 0) - Number(order.discountAmount || 0))
  const tier = settings.tiers.filter((item) => moneyPaidForGoods >= item.minSubtotal).at(-1)
  const raw = Math.floor(moneyPaidForGoods * (tier?.percent || 0) / 100); if (!raw) return
  const key = `accrual:${orderId}`
  let notificationAmount = 0
  await withLoyaltyClientLock(clientId, async () => {
    const previous = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
    const previousEntry = previous.docs[0] as unknown as Operation | undefined
    if (previousEntry) {
      notificationAmount = Math.max(0, Number(previousEntry.amount) || 0)
      return
    }

    const snapshot = await getLoyaltySnapshot(payload, clientId)
    const amount = Math.min(raw, Math.max(0, settings.balanceCap - snapshot.balance))
    if (!amount) return
    const expiresAt = new Date(Date.now() + settings.expiryDays * 86400000).toISOString()
    // A new completed purchase restarts the expiry period for every positive,
    // still-active source of points, including points returned for an order.
    const existing = await findAllLoyaltyOperations(payload, {
      and: [{ client: { equals: clientId } }, { status: { equals: "active" } }],
    })
    for (const entry of existing) {
      if ((entry.type === "accrual" || entry.type === "refund") && Number(entry.amount || 0) > 0) {
        await payload.update({ collection: "loyalty-operations", id: entry.id, data: { expiresAt }, overrideAccess: true })
      }
    }
    await payload.create({ collection: "loyalty-operations", data: { client: asRelationshipId(clientId), order: asRelationshipId(orderId), type: "accrual", amount, status: "active", expiresAt, idempotencyKey: key, note: `Начисление ${tier?.percent || 0}% после доставки заказа` }, overrideAccess: true })
    notificationAmount = amount
  })

  // Delivery records make this retry-safe: already sent channels are skipped,
  // while failed channels can be attempted again by the reconciliation cron.
  if (notificationAmount > 0) {
    await notifyLoyaltyClient(payload, clientId, {
      key,
      title: "Начислены баллы",
      message: `За доставленный заказ №${orderNumber} начислено ${notificationAmount.toLocaleString("ru-RU")} Б.`,
      data: { type: "accrual", amount: notificationAmount, orderId, orderNumber },
    })
  }
}

export async function sendLoyaltyExpiryReminders(payload: Payload): Promise<{ remindedClients: number }> {
  const operations = await findAllLoyaltyOperations(payload, { status: { equals: "active" } })
  const reminders = new Map<string, { clientId: Id; expiresAt: string; amount: number; days: number; stage: 7 | 3 }>()
  const now = Date.now()
  for (const entry of operations) {
    if (!entry.expiresAt || Number(entry.amount || 0) <= 0) continue
    const days = Math.ceil((Date.parse(entry.expiresAt) - now) / 86400000)
    const stage = days <= 7 && days > 3 ? 7 : days <= 3 && days >= 0 ? 3 : null
    if (!stage) continue
    const clientId = asId(entry.client)
    if (!clientId) continue
    const expiryDate = new Date(entry.expiresAt).toISOString().slice(0, 10)
    const reminderKey = `${clientId}:${expiryDate}:${stage}`
    const current = reminders.get(reminderKey)
    reminders.set(reminderKey, { clientId, expiresAt: current?.expiresAt || entry.expiresAt, days, stage, amount: (current?.amount || 0) + Number(entry.amount || 0) })
  }

  for (const reminder of reminders.values()) {
    const snapshot = await getLoyaltySnapshot(payload, reminder.clientId)
    const amount = Math.min(reminder.amount, snapshot.balance)
    if (amount <= 0) continue
    await notifyLoyaltyClient(payload, reminder.clientId, {
      key: `expiry-reminder:${reminder.clientId}:${new Date(reminder.expiresAt).toISOString().slice(0, 10)}:${reminder.stage}`,
      title: "Скоро сгорят баллы",
      message: `Через ${reminder.days} ${daysLabel(reminder.days)} сгорят ${amount.toLocaleString("ru-RU")} Б. Используйте их при оплате кофе.`,
      data: { type: "expiry_reminder", amount, days: reminder.days },
    })
  }
  return { remindedClients: reminders.size }
}

export async function reconcileDeliveredLoyaltyOrders(payload: Payload): Promise<{ checked: number }> {
  const where: Where = {
    and: [
      { salesChannel: { equals: "retail" } },
      { customerType: { equals: "individual" } },
      { status: { equals: "delivered" } },
      { paymentStatus: { equals: "paid" } },
    ],
  }
  let checked = 0
  let page = 1
  while (true) {
    const orders = await payload.find({ collection: "orders", where, limit: 200, page, depth: 0, overrideAccess: true })
    for (const order of orders.docs as unknown as Record<string, unknown>[]) {
      await accrueLoyaltyForDeliveredOrder(payload, order)
      checked += 1
    }
    if (!orders.hasNextPage) break
    page = orders.nextPage || page + 1
  }
  return { checked }
}

export async function reverseLoyaltyForReturnedOrder(payload: Payload, order: Record<string, unknown>) {
  const clientId = asId(order.client); const orderId = asId(order.id)
  if (!clientId || !orderId) return
  const settings = await getLoyaltySettings(payload); if (!settings.enabled) return
  await withLoyaltyClientLock(clientId, async () => {
    const source = await findAllLoyaltyOperations(payload, { order: { equals: orderId } })
    for (const entry of source) {
      if (entry.type === "accrual" && entry.status === "active") {
        const key = `reversal:${entry.id}`
        const prior = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
        if (!prior.totalDocs) await payload.create({ collection: "loyalty-operations", data: { client: asRelationshipId(clientId), order: asRelationshipId(orderId), type: "reversal", amount: -Math.abs(Number(entry.amount) || 0), status: "active", idempotencyKey: key, note: "Аннулирование начисления после отмены или возврата" }, overrideAccess: true })
      }
    }
    const redeemed = Math.floor(source
      .filter((entry) => entry.type === "redemption" && entry.status === "active")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount) || 0), 0))
    if (redeemed > 0) {
      const key = `refund:${orderId}`
      const prior = await payload.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: key } }, limit: 1, depth: 0, overrideAccess: true })
      if (!prior.totalDocs) await payload.create({ collection: "loyalty-operations", data: { client: asRelationshipId(clientId), order: asRelationshipId(orderId), type: "refund", amount: redeemed, status: "active", expiresAt: new Date(Date.now() + settings.expiryDays * 86400000).toISOString(), idempotencyKey: key, note: "Возврат списанных баллов после отмены или возврата заказа" }, overrideAccess: true })
    }
  })
}
