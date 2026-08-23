import { getPayload } from "payload"
import { loadEnvConfig } from "@next/env"
import { randomUUID } from "node:crypto"
import { getPool } from "@/lib/db"
import {
  expireLoyaltyPoints,
  finalizeLoyaltyForPaidOrder,
  getLoyaltySnapshot,
  reconcileDeliveredLoyaltyOrders,
  reserveLoyaltyPoints,
  sendLoyaltyExpiryReminders,
} from "@/lib/loyalty"

if (process.env.NODE_ENV === "production" || process.env.LOYALTY_E2E_ALLOW_MUTATION !== "true") {
  throw new Error("Этот тест меняет только локальную БД. Запустите с LOYALTY_E2E_ALLOW_MUTATION=true вне production.")
}

const stamp = Date.now()
const testEmail = `loyalty-e2e-${stamp}@example.invalid`
const testName = `LOYALTY E2E ${stamp}`

type TestDocument = { id: number; expiresAt?: string | null; [key: string]: unknown }
type TestQuery = { docs: TestDocument[]; totalDocs: number }
type PayloadTestApi = {
  findGlobal(options: Record<string, unknown>): Promise<TestDocument>
  updateGlobal(options: Record<string, unknown>): Promise<TestDocument>
  create(options: Record<string, unknown>): Promise<TestDocument>
  update(options: Record<string, unknown>): Promise<TestDocument>
  find(options: Record<string, unknown>): Promise<TestQuery>
  findByID(options: Record<string, unknown>): Promise<TestDocument>
  sendEmail(message: { to?: string; subject?: string }): Promise<unknown>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function afterDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString()
}

async function main() {
  loadEnvConfig(process.cwd())
  const { refreshYooKassaOrderPayment } = await import("@/lib/payments/yookassa-order-status")
  const { default: configPromise } = await import("@payload-config")
  const payload = await getPayload({ config: configPromise })
  const api = payload as unknown as PayloadTestApi
  const previousSettings = await api.findGlobal({ slug: "loyalty-settings", depth: 0, overrideAccess: true })
  const previousPaymentSettings = await api.findGlobal({ slug: "payment-settings", depth: 0, overrideAccess: true })
  const sentEmails: Array<{ to?: string; subject?: string }> = []
  const originalSendEmail = api.sendEmail.bind(api)
  let clientId: number | null = null
  const extraClientIds: number[] = []
  let failEmailOnceFor: string | null = null
  let forcedEmailFailureDone = false
  let socialAuthUserId: string | null = null
  const originalFetch = globalThis.fetch
  const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN
  const originalVkToken = process.env.VK_COMMUNITY_ACCESS_TOKEN

  // The test must exercise notification creation without sending a real email.
  api.sendEmail = async (message: { to?: string; subject?: string }) => {
    sentEmails.push({ to: message.to, subject: message.subject })
    if (message.to === failEmailOnceFor && !forcedEmailFailureDone) {
      forcedEmailFailureDone = true
      throw new Error("Simulated email transport failure")
    }
  }

  try {
    await api.updateGlobal({
      slug: "loyalty-settings",
      data: {
        enabled: true,
        expiryDays: 60,
        balanceCap: 5000,
        maxRedemptionPercent: 20,
        tiers: [
          { minSubtotal: 0, percent: 3 },
          { minSubtotal: 1000, percent: 5 },
          { minSubtotal: 5000, percent: 12 },
        ],
      },
      overrideAccess: true,
    })

    const client = await api.create({
      collection: "clients",
      data: {
        fullName: testName,
        email: testEmail,
        salesChannel: "retail",
        customerType: "individual",
      },
      overrideAccess: true,
    })
    clientId = Number(client.id)

    const deliveredOrder = await api.create({
      collection: "orders",
      data: {
        salesChannel: "retail",
        customerType: "individual",
        checkoutMode: "account",
        paymentMethod: "yookassa",
        paymentStatus: "pending",
        subtotal: 1000,
        discountAmount: 0,
        deliveryCost: 0,
        total: 1000,
        status: "delivered",
        client: clientId,
        customerFullName: testName,
        customerEmail: testEmail,
        deliveryMethod: "self_pickup",
      },
      overrideAccess: true,
    })

    let snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === 0, `Неоплаченный доставленный заказ не должен начислять баллы, получено ${snapshot.balance}`)

    await api.update({
      collection: "orders",
      id: deliveredOrder.id,
      data: { paymentStatus: "paid" },
      overrideAccess: true,
    })

    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === 50, `После доставки 1 000 ₽ должно быть 50 Б, получено ${snapshot.balance}`)

    const redemptionOrder = await api.create({
      collection: "orders",
      data: {
        salesChannel: "retail",
        customerType: "individual",
        checkoutMode: "account",
        paymentMethod: "yookassa",
        paymentStatus: "pending",
        subtotal: 100,
        discountAmount: 20,
        loyaltyPointsRedeemed: 20,
        deliveryCost: 0,
        total: 80,
        status: "new",
        client: clientId,
        customerFullName: testName,
        customerEmail: testEmail,
        deliveryMethod: "self_pickup",
      },
      overrideAccess: true,
    })

    await reserveLoyaltyPoints(payload, { clientId, orderId: redemptionOrder.id, amount: 20, coffeeSubtotal: 100 })
    await finalizeLoyaltyForPaidOrder(payload, { ...redemptionOrder, paymentStatus: "paid" })
    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === 30 && snapshot.reserved === 0, `После списания 20 Б ожидалось 30 Б без резерва, получено ${snapshot.balance} Б и резерв ${snapshot.reserved} Б`)

    await api.update({
      collection: "orders",
      id: redemptionOrder.id,
      data: { status: "returned", paymentStatus: "refunded" },
      overrideAccess: true,
    })
    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === 50, `После возврата должны восстановиться 20 Б, получено ${snapshot.balance}`)

    const refundOperation = await api.find({
      collection: "loyalty-operations",
      where: { idempotencyKey: { equals: `refund:${redemptionOrder.id}` } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    assert(refundOperation.totalDocs === 1, "Операция возврата баллов не создана")
    const firstRefundExpiry = new Date(refundOperation.docs[0].expiresAt as string).getTime()

    await api.create({
      collection: "orders",
      data: {
        salesChannel: "retail",
        customerType: "individual",
        checkoutMode: "account",
        paymentMethod: "yookassa",
        paymentStatus: "paid",
        subtotal: 1000,
        discountAmount: 0,
        deliveryCost: 0,
        total: 1000,
        status: "delivered",
        client: clientId,
        customerFullName: testName,
        customerEmail: testEmail,
        deliveryMethod: "self_pickup",
      },
      overrideAccess: true,
    })

    const refreshedRefund = await api.findByID({ collection: "loyalty-operations", id: refundOperation.docs[0].id, depth: 0, overrideAccess: true })
    const refreshedRefundExpiry = new Date(refreshedRefund.expiresAt as string).getTime()
    assert(refreshedRefundExpiry > firstRefundExpiry, "Новая доставка не продлила срок возвращённых баллов")

    const cancelRedemptionOrder = await api.create({
      collection: "orders",
      data: {
        salesChannel: "retail", customerType: "individual", checkoutMode: "account",
        paymentMethod: "yookassa", paymentStatus: "pending", subtotal: 100,
        discountAmount: 20, loyaltyPointsRedeemed: 20, deliveryCost: 0, total: 80,
        status: "new", client: clientId, customerFullName: testName,
        customerEmail: testEmail, deliveryMethod: "self_pickup",
      },
      overrideAccess: true,
    })
    await reserveLoyaltyPoints(payload, { clientId, orderId: cancelRedemptionOrder.id, amount: 20, coffeeSubtotal: 100 })
    await finalizeLoyaltyForPaidOrder(payload, { ...cancelRedemptionOrder, paymentStatus: "paid" })
    const beforePaidCancellation = (await getLoyaltySnapshot(payload, clientId)).balance
    await api.update({ collection: "orders", id: cancelRedemptionOrder.id, data: { status: "cancelled", paymentStatus: "paid" }, overrideAccess: true })
    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === beforePaidCancellation + 20, `Отмена оплаченного заказа должна вернуть 20 Б, получено ${snapshot.balance - beforePaidCancellation}`)

    const pendingCancellationOrder = await api.create({
      collection: "orders",
      data: {
        salesChannel: "retail", customerType: "individual", checkoutMode: "account",
        paymentMethod: "yookassa", paymentStatus: "pending", subtotal: 100,
        discountAmount: 20, loyaltyPointsRedeemed: 20, deliveryCost: 0, total: 80,
        status: "new", client: clientId, customerFullName: testName,
        customerEmail: testEmail, deliveryMethod: "self_pickup",
      },
      overrideAccess: true,
    })
    const beforePendingCancellation = (await getLoyaltySnapshot(payload, clientId)).balance
    await reserveLoyaltyPoints(payload, { clientId, orderId: pendingCancellationOrder.id, amount: 20, coffeeSubtotal: 100 })
    await api.update({ collection: "orders", id: pendingCancellationOrder.id, data: { status: "cancelled", paymentStatus: "cancelled" }, overrideAccess: true })
    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === beforePendingCancellation && snapshot.reserved === 0, "Отмена неоплаченного заказа должна снять резерв без создания лишних баллов")
    const invalidPendingRefund = await api.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: `refund:${pendingCancellationOrder.id}` } }, limit: 1, depth: 0, overrideAccess: true })
    assert(invalidPendingRefund.totalDocs === 0, "Для неоплаченного заказа ошибочно создан возврат баллов")

    const active = await api.find({
      collection: "loyalty-operations",
      where: { and: [{ client: { equals: clientId } }, { status: { equals: "active" } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    for (const operation of active.docs.filter((operation) => Number(operation.amount) > 0)) {
      await api.update({ collection: "loyalty-operations", id: operation.id, data: { expiresAt: afterDays(7) }, overrideAccess: true })
    }
    const sevenDayReminders = await sendLoyaltyExpiryReminders(payload)
    assert(sevenDayReminders.remindedClients === 1, `Ожидалось одно напоминание за 7 дней, получено ${sevenDayReminders.remindedClients}`)

    for (const operation of active.docs.filter((operation) => Number(operation.amount) > 0)) {
      await api.update({ collection: "loyalty-operations", id: operation.id, data: { expiresAt: afterDays(3) }, overrideAccess: true })
    }
    const reminders = await sendLoyaltyExpiryReminders(payload)
    assert(reminders.remindedClients === 1, `Ожидалось одно напоминание за 3 дня, получено ${reminders.remindedClients}`)
    assert(sentEmails.some((email) => email.to === testEmail && email.subject?.includes("Скоро сгорят баллы")), "Email-напоминание не сформировано")

    const expiring = await api.find({
      collection: "loyalty-operations",
      where: { and: [{ client: { equals: clientId } }, { status: { equals: "active" } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const positiveOperations = expiring.docs.filter((operation) => Number(operation.amount) > 0)
    assert(positiveOperations.length >= 2, "Для проверки частичного сгорания нужны минимум две операции начисления")
    const totalPositive = positiveOperations.reduce((sum, operation) => sum + Number(operation.amount || 0), 0)
    const balanceBeforePartialExpiry = (await getLoyaltySnapshot(payload, clientId)).balance
    const alreadyConsumed = Math.max(0, totalPositive - balanceBeforePartialExpiry)
    const operationToExpire = positiveOperations.find((operation) => Number(operation.amount || 0) > alreadyConsumed) || positiveOperations[0]
    const futureOperations = positiveOperations.filter((operation) => operation.id !== operationToExpire.id)
    const amountToExpire = Number(operationToExpire.amount)
    const futurePositiveTotal = futureOperations.reduce((sum, operation) => sum + Number(operation.amount || 0), 0)
    const expectedExpiredAmount = Math.min(amountToExpire, Math.max(0, balanceBeforePartialExpiry - futurePositiveTotal))
    await api.update({ collection: "loyalty-operations", id: operationToExpire.id, data: { expiresAt: afterDays(-1) }, overrideAccess: true })
    for (const operation of futureOperations) {
      await api.update({ collection: "loyalty-operations", id: operation.id, data: { expiresAt: afterDays(10) }, overrideAccess: true })
    }
    const partiallyExpired = await expireLoyaltyPoints(payload)
    assert(partiallyExpired.expiredClients === 1, `Ожидалось частичное сгорание у одного клиента, получено ${partiallyExpired.expiredClients}`)
    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === balanceBeforePartialExpiry - expectedExpiredAmount, `Частичное сгорание рассчитано неверно: ожидалось ${balanceBeforePartialExpiry - expectedExpiredAmount} Б, получено ${snapshot.balance}`)

    const due = await api.find({
      collection: "loyalty-operations",
      where: { and: [{ client: { equals: clientId } }, { status: { equals: "active" } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    for (const operation of due.docs.filter((operation) => Number(operation.amount) > 0)) {
      await api.update({ collection: "loyalty-operations", id: operation.id, data: { expiresAt: afterDays(-1) }, overrideAccess: true })
    }
    const expired = await expireLoyaltyPoints(payload)
    assert(expired.expiredClients === 1, `Ожидалоcь сгорание у одного клиента, получено ${expired.expiredClients}`)
    snapshot = await getLoyaltySnapshot(payload, clientId)
    assert(snapshot.balance === 0, `После сгорания баланс должен быть 0 Б, получено ${snapshot.balance}`)

    const thresholdClient = await api.create({ collection: "clients", data: { fullName: `${testName} THRESHOLDS`, email: `threshold-${testEmail}`, salesChannel: "retail", customerType: "individual" }, overrideAccess: true })
    const thresholdClientId = Number(thresholdClient.id)
    extraClientIds.push(thresholdClientId)
    const thresholdCases = [
      { subtotal: 999, expected: 29 },
      { subtotal: 1000, expected: 50 },
      { subtotal: 4999, expected: 249 },
      { subtotal: 5000, expected: 600 },
    ]
    for (const testCase of thresholdCases) {
      const order = await api.create({
        collection: "orders",
        data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "paid", subtotal: testCase.subtotal, discountAmount: 0, deliveryCost: 0, total: testCase.subtotal, status: "delivered", client: thresholdClientId, customerFullName: testName, customerEmail: `threshold-${testEmail}`, deliveryMethod: "self_pickup" },
        overrideAccess: true,
      })
      const operation = await api.find({ collection: "loyalty-operations", where: { idempotencyKey: { equals: `accrual:${order.id}` } }, limit: 1, depth: 0, overrideAccess: true })
      assert(Number(operation.docs[0]?.amount) === testCase.expected, `Для ${testCase.subtotal} ₽ ожидалось ${testCase.expected} Б, получено ${operation.docs[0]?.amount}`)
    }
    await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "paid", subtotal: 100000, discountAmount: 0, deliveryCost: 0, total: 100000, status: "delivered", client: thresholdClientId, customerFullName: testName, customerEmail: `threshold-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    assert((await getLoyaltySnapshot(payload, thresholdClientId)).balance === 5000, "Ограничение баланса 5 000 Б не сработало")

    const retryEmail = `retry-${testEmail}`
    failEmailOnceFor = retryEmail
    const retryClient = await api.create({ collection: "clients", data: { fullName: `${testName} RETRY`, email: retryEmail, salesChannel: "retail", customerType: "individual" }, overrideAccess: true })
    const retryClientId = Number(retryClient.id)
    extraClientIds.push(retryClientId)
    await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "paid", subtotal: 1000, discountAmount: 0, deliveryCost: 0, total: 1000, status: "delivered", client: retryClientId, customerFullName: testName, customerEmail: retryEmail, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    assert(sentEmails.filter((email) => email.to === retryEmail).length === 1, "Не выполнена первая попытка email-уведомления")
    await reconcileDeliveredLoyaltyOrders(payload)
    assert(sentEmails.filter((email) => email.to === retryEmail).length === 2, "Reconcile не повторил неуспешное email-уведомление")
    const retryDelivery = await getPool().query<{ status: string; attempts: number }>("select status, attempts from loyalty_notification_deliveries where client_id = $1 and channel = 'email'", [retryClientId])
    assert(retryDelivery.rows[0]?.status === "sent" && retryDelivery.rows[0]?.attempts === 2, "Повторная доставка email не отмечена как успешная")

    const socialCalls: string[] = []
    process.env.TELEGRAM_BOT_TOKEN = "loyalty-e2e-telegram-token"
    process.env.VK_COMMUNITY_ACCESS_TOKEN = "loyalty-e2e-vk-token"
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.startsWith("https://api.telegram.org/")) {
        socialCalls.push("telegram")
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      if (url === "https://api.vk.com/method/messages.send") {
        socialCalls.push("vk")
        return new Response(JSON.stringify({ response: 1 }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return originalFetch(input, init)
    }
    socialAuthUserId = randomUUID()
    const socialEmail = `social-${testEmail}`
    const pool = getPool()
    await pool.query(
      `insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
       values ($1, 'authenticated', 'authenticated', $2, now(), '{}'::jsonb, '{}'::jsonb, now(), now(), false, false)`,
      [socialAuthUserId, socialEmail],
    )
    const socialClient = await api.create({ collection: "clients", data: { fullName: `${testName} SOCIAL`, email: socialEmail, supabaseId: socialAuthUserId, salesChannel: "retail", customerType: "individual" }, overrideAccess: true })
    const socialClientId = Number(socialClient.id)
    extraClientIds.push(socialClientId)
    await pool.query(
      `insert into public.auth_social_identities (user_id, provider, provider_user_id, messaging_id, created_at, updated_at)
       values ($1, 'telegram', 'telegram-subject', '123456789', now(), now()), ($1, 'vk', '987654321', null, now(), now())`,
      [socialAuthUserId],
    )
    await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "paid", subtotal: 1000, discountAmount: 0, deliveryCost: 0, total: 1000, status: "delivered", client: socialClientId, customerFullName: testName, customerEmail: socialEmail, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    assert(socialCalls.includes("telegram") && socialCalls.includes("vk"), "Уведомление о начислении не дошло до адаптеров Telegram и VK")
    const socialDeliveries = await pool.query<{ channel: string; status: string }>("select channel, status from loyalty_notification_deliveries where client_id = $1", [socialClientId])
    assert(["telegram", "vk"].every((channel) => socialDeliveries.rows.some((row) => row.channel === channel && row.status === "sent")), "Telegram/VK доставка не отмечена как успешная")
    globalThis.fetch = originalFetch

    await api.updateGlobal({
      slug: "payment-settings",
      data: { enabled: true, shopId: "loyalty-e2e", secretKey: "loyalty-e2e", returnUrl: "http://localhost:3001/order/success", webhookUrl: "http://localhost:3001/api/shop/payments/yookassa/webhook" },
      overrideAccess: true,
    })
    const paymentClient = await api.create({ collection: "clients", data: { fullName: `${testName} PAYMENT`, email: `payment-${testEmail}`, salesChannel: "retail", customerType: "individual" }, overrideAccess: true })
    const paymentClientId = Number(paymentClient.id)
    extraClientIds.push(paymentClientId)
    await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "paid", subtotal: 1000, discountAmount: 0, deliveryCost: 0, total: 1000, status: "delivered", client: paymentClientId, customerFullName: testName, customerEmail: `payment-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    const paidPaymentId = `loyalty-e2e-paid-${stamp}`
    const paidPaymentOrder = await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "pending", paymentExternalId: paidPaymentId, subtotal: 100, discountAmount: 20, loyaltyPointsRedeemed: 20, deliveryCost: 0, total: 80, status: "new", client: paymentClientId, customerFullName: testName, customerEmail: `payment-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    await reserveLoyaltyPoints(payload, { clientId: paymentClientId, orderId: paidPaymentOrder.id, amount: 20, coffeeSubtotal: 100 })
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.endsWith(`/payments/${paidPaymentId}`)) {
        return new Response(JSON.stringify({ id: paidPaymentId, status: "succeeded", amount: { value: "80.00", currency: "RUB" }, metadata: { order_id: String(paidPaymentOrder.id), order_number: paidPaymentOrder.orderId } }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return originalFetch(input, init)
    }
    const paidRefresh = await refreshYooKassaOrderPayment(paidPaymentId, "payment")
    assert(paidRefresh.ok && paidRefresh.status === "paid", "Успешный платёж YooKassa не подтверждён")
    assert((await getLoyaltySnapshot(payload, paymentClientId)).balance === 30, "После успешной оплаты не финализировано списание 20 Б")

    const cancelledPaymentId = `loyalty-e2e-cancelled-${stamp}`
    const cancelledPaymentOrder = await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "pending", paymentExternalId: cancelledPaymentId, subtotal: 100, discountAmount: 20, loyaltyPointsRedeemed: 20, deliveryCost: 0, total: 80, status: "new", client: paymentClientId, customerFullName: testName, customerEmail: `payment-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    await reserveLoyaltyPoints(payload, { clientId: paymentClientId, orderId: cancelledPaymentOrder.id, amount: 20, coffeeSubtotal: 100 })
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.endsWith(`/payments/${cancelledPaymentId}`)) {
        return new Response(JSON.stringify({ id: cancelledPaymentId, status: "canceled", amount: { value: "80.00", currency: "RUB" }, metadata: { order_id: String(cancelledPaymentOrder.id), order_number: cancelledPaymentOrder.orderId } }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return originalFetch(input, init)
    }
    const cancelledRefresh = await refreshYooKassaOrderPayment(cancelledPaymentId, "payment")
    assert(cancelledRefresh.ok && cancelledRefresh.status === "cancelled", "Отмена платежа YooKassa не синхронизирована")
    const cancelledSnapshot = await getLoyaltySnapshot(payload, paymentClientId)
    assert(cancelledSnapshot.balance === 30 && cancelledSnapshot.reserved === 0, "Отмена YooKassa не освободила резерв без лишнего возврата")
    globalThis.fetch = originalFetch

    const concurrencyClient = await api.create({ collection: "clients", data: { fullName: `${testName} CONCURRENCY`, email: `concurrency-${testEmail}`, salesChannel: "retail", customerType: "individual" }, overrideAccess: true })
    const concurrencyClientId = Number(concurrencyClient.id)
    extraClientIds.push(concurrencyClientId)
    await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "paid", subtotal: 1000, discountAmount: 0, deliveryCost: 0, total: 1000, status: "delivered", client: concurrencyClientId, customerFullName: testName, customerEmail: `concurrency-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    const idempotentOrder = await api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "pending", subtotal: 200, discountAmount: 40, loyaltyPointsRedeemed: 40, deliveryCost: 0, total: 160, status: "new", client: concurrencyClientId, customerFullName: testName, customerEmail: `concurrency-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })
    const duplicateReservations = await Promise.allSettled([1, 2].map(() => reserveLoyaltyPoints(payload, { clientId: concurrencyClientId, orderId: idempotentOrder.id, amount: 40, coffeeSubtotal: 200 })))
    assert(duplicateReservations.every((result) => result.status === "fulfilled"), "Повтор одного и того же резерва не является идемпотентным")
    assert((await getLoyaltySnapshot(payload, concurrencyClientId)).reserved === 40, "Повтор одного резерва создал двойное удержание")
    await api.update({ collection: "orders", id: idempotentOrder.id, data: { status: "cancelled", paymentStatus: "cancelled" }, overrideAccess: true })
    const concurrentOrders = await Promise.all([1, 2].map(() => api.create({
      collection: "orders",
      data: { salesChannel: "retail", customerType: "individual", checkoutMode: "account", paymentMethod: "yookassa", paymentStatus: "pending", subtotal: 200, discountAmount: 40, loyaltyPointsRedeemed: 40, deliveryCost: 0, total: 160, status: "new", client: concurrencyClientId, customerFullName: testName, customerEmail: `concurrency-${testEmail}`, deliveryMethod: "self_pickup" },
      overrideAccess: true,
    })))
    const concurrentReservations = await Promise.allSettled(concurrentOrders.map((order) => reserveLoyaltyPoints(payload, { clientId: concurrencyClientId, orderId: order.id, amount: 40, coffeeSubtotal: 200 })))
    assert(concurrentReservations.filter((result) => result.status === "fulfilled").length === 1, "Параллельные резервы позволили списать больше доступного баланса")
    const concurrentSnapshot = await getLoyaltySnapshot(payload, concurrencyClientId)
    assert(concurrentSnapshot.balance === 50 && concurrentSnapshot.reserved === 40 && concurrentSnapshot.available === 10, "Баланс после параллельного резерва некорректен")
    const concurrentPositive = await api.find({ collection: "loyalty-operations", where: { and: [{ client: { equals: concurrencyClientId } }, { type: { equals: "accrual" } }] }, limit: 10, depth: 0, overrideAccess: true })
    for (const operation of concurrentPositive.docs) {
      await api.update({ collection: "loyalty-operations", id: operation.id, data: { expiresAt: afterDays(-1) }, overrideAccess: true })
    }
    await expireLoyaltyPoints(payload)
    assert((await getLoyaltySnapshot(payload, concurrencyClientId)).balance === 50, "Баллы сгорели во время активного платёжного резерва")
    for (const order of concurrentOrders) {
      await api.update({ collection: "orders", id: order.id, data: { status: "cancelled", paymentStatus: "cancelled" }, overrideAccess: true })
    }
    await expireLoyaltyPoints(payload)
    assert((await getLoyaltySnapshot(payload, concurrencyClientId)).balance === 0, "После снятия резерва просроченные баллы не сгорели")

    console.log(JSON.stringify({
      ok: true,
      checked: ["paid-delivered-accrual", "unpaid-delivered-rejection", "redemption", "refund", "paid-cancellation-refund", "pending-cancellation-release", "refund-expiry-extension", "expiry-reminder-7-days", "expiry-reminder-3-days", "partial-expiry", "expiry", "tier-boundaries", "balance-cap", "notification-retry", "telegram-notification", "vk-notification", "yookassa-paid-finalization", "yookassa-cancel-release", "idempotent-reservation", "concurrent-reservation", "reservation-expiry-protection"],
      sentEmailCount: sentEmails.length,
    }))
  } finally {
    api.sendEmail = originalSendEmail
    globalThis.fetch = originalFetch
    if (originalTelegramToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken
    if (originalVkToken === undefined) delete process.env.VK_COMMUNITY_ACCESS_TOKEN
    else process.env.VK_COMMUNITY_ACCESS_TOKEN = originalVkToken
    if (clientId) {
      const pool = getPool()
      for (const id of [clientId, ...extraClientIds]) {
        await pool.query("delete from loyalty_notification_deliveries where client_id = $1", [id])
        await pool.query("delete from loyalty_operations where client_id = $1", [id])
        await pool.query("delete from orders where client_id = $1", [id])
        await pool.query("delete from clients where id = $1", [id])
      }
      if (socialAuthUserId) {
        await pool.query("delete from public.auth_social_identities where user_id = $1", [socialAuthUserId])
        await pool.query("delete from auth.users where id = $1", [socialAuthUserId])
      }
    }
    await api.updateGlobal({
      slug: "loyalty-settings",
      data: {
        enabled: previousSettings.enabled,
        expiryDays: previousSettings.expiryDays,
        balanceCap: previousSettings.balanceCap,
        maxRedemptionPercent: previousSettings.maxRedemptionPercent,
        tiers: previousSettings.tiers,
      },
      overrideAccess: true,
    })
    await getPool().query(
      `update payment_settings
          set enabled = $1, shop_id = $2, secret_key = $3,
              return_url = $4, webhook_url = $5, updated_at = now()`,
      [
        previousPaymentSettings.enabled === true,
        previousPaymentSettings.shopId || null,
        previousPaymentSettings.secretKey || null,
        previousPaymentSettings.returnUrl || null,
        previousPaymentSettings.webhookUrl || null,
      ],
    )
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
