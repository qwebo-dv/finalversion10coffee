import { getPayload } from "payload"
import { loadEnvConfig } from "@next/env"
import { getPool } from "@/lib/db"
import {
  expireLoyaltyPoints,
  finalizeLoyaltyForPaidOrder,
  getLoyaltySnapshot,
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
  const { default: configPromise } = await import("@payload-config")
  const payload = await getPayload({ config: configPromise })
  const api = payload as unknown as PayloadTestApi
  const previousSettings = await api.findGlobal({ slug: "loyalty-settings", depth: 0, overrideAccess: true })
  const sentEmails: Array<{ to?: string; subject?: string }> = []
  const originalSendEmail = api.sendEmail.bind(api)
  let clientId: number | null = null

  // The test must exercise notification creation without sending a real email.
  api.sendEmail = async (message: { to?: string; subject?: string }) => {
    sentEmails.push({ to: message.to, subject: message.subject })
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

    let snapshot = await getLoyaltySnapshot(payload, clientId)
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

    const active = await api.find({
      collection: "loyalty-operations",
      where: { and: [{ client: { equals: clientId } }, { status: { equals: "active" } }] },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    for (const operation of active.docs.filter((operation) => Number(operation.amount) > 0)) {
      await api.update({ collection: "loyalty-operations", id: operation.id, data: { expiresAt: afterDays(3) }, overrideAccess: true })
    }
    const reminders = await sendLoyaltyExpiryReminders(payload)
    assert(reminders.remindedClients === 1, `Ожидалось одно напоминание за 3 дня, получено ${reminders.remindedClients}`)
    assert(sentEmails.some((email) => email.to === testEmail && email.subject?.includes("Скоро сгорят баллы")), "Email-напоминание не сформировано")

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

    console.log(JSON.stringify({
      ok: true,
      checked: ["accrual", "redemption", "refund", "refund-expiry-extension", "expiry-reminder-email", "expiry"],
      sentEmailCount: sentEmails.length,
    }))
  } finally {
    api.sendEmail = originalSendEmail
    if (clientId) {
      const pool = getPool()
      await pool.query("delete from loyalty_notification_deliveries where client_id = $1", [clientId])
      await pool.query("delete from loyalty_operations where client_id = $1", [clientId])
      await pool.query("delete from orders where client_id = $1", [clientId])
      await pool.query("delete from clients where id = $1", [clientId])
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
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
