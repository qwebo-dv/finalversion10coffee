export interface SberAcquiringConfig {
  enabled: boolean
  apiUrl: string
  username: string
  password: string
  returnUrl: string
  failUrl: string
}

interface SberErrorResponse {
  errorCode?: string | number
  errorMessage?: string
}

interface SberRegisterResponse extends SberErrorResponse {
  orderId?: string
  formUrl?: string
}

interface SberStatusResponse extends SberErrorResponse {
  orderStatus?: number
  actionCode?: number
  actionCodeDescription?: string
  amount?: number
  orderNumber?: string
}

export type SberPaymentStatus = "pending" | "paid" | "cancelled" | "refunded" | "failed"

export function getSberAcquiringConfig(): SberAcquiringConfig {
  return {
    enabled: process.env.SBER_ACQUIRING_ENABLED === "true",
    apiUrl: (process.env.SBER_ACQUIRING_API_URL || "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/v1").replace(/\/$/, ""),
    username: process.env.SBER_ACQUIRING_USERNAME || "",
    password: process.env.SBER_ACQUIRING_PASSWORD || "",
    returnUrl: process.env.SBER_ACQUIRING_RETURN_URL || "https://shop.10coffee.ru/order/success",
    failUrl: process.env.SBER_ACQUIRING_FAIL_URL || "https://shop.10coffee.ru/order/failed",
  }
}

export function isSberAcquiringReady(config = getSberAcquiringConfig()) {
  return Boolean(config.enabled && config.username && config.password && config.returnUrl)
}

async function sberRequest<T>(method: string, body: Record<string, unknown>, config: SberAcquiringConfig): Promise<T> {
  const response = await fetch(`${config.apiUrl}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: config.username,
      password: config.password,
      ...body,
    }),
    cache: "no-store",
  })

  const result = await response.json().catch(() => null) as T | null
  if (!response.ok || !result) {
    throw new Error(`Сбер вернул HTTP ${response.status}`)
  }
  return result
}

export async function createSberPayment(params: {
  orderNumber: string
  amountRubles: number
  description?: string
  clientEmail?: string
  clientId?: string
}) {
  const config = getSberAcquiringConfig()
  if (!isSberAcquiringReady(config)) {
    return { ok: false as const, error: "Онлайн-оплата Сбер пока не подключена" }
  }

  const amount = Math.round(params.amountRubles * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false as const, error: "Некорректная сумма платежа" }
  }

  const result = await sberRequest<SberRegisterResponse>("register.do", {
    orderNumber: params.orderNumber,
    amount,
    currency: "643",
    returnUrl: config.returnUrl,
    failUrl: config.failUrl,
    description: params.description,
    clientId: params.clientId,
    email: params.clientEmail,
    language: "ru",
  }, config)

  if (String(result.errorCode || "0") !== "0" || !result.orderId || !result.formUrl) {
    return {
      ok: false as const,
      error: result.errorMessage || `Ошибка регистрации платежа (${result.errorCode || "unknown"})`,
    }
  }

  return {
    ok: true as const,
    paymentId: result.orderId,
    paymentUrl: result.formUrl,
  }
}

export async function getSberPaymentStatus(paymentId: string) {
  const config = getSberAcquiringConfig()
  if (!isSberAcquiringReady(config)) {
    return { ok: false as const, error: "Онлайн-оплата Сбер пока не подключена" }
  }

  const result = await sberRequest<SberStatusResponse>("getOrderStatusExtended.do", {
    orderId: paymentId,
  }, config)

  if (String(result.errorCode || "0") !== "0") {
    return { ok: false as const, error: result.errorMessage || "Не удалось проверить платёж" }
  }

  const statusMap: Record<number, SberPaymentStatus> = {
    0: "pending",
    1: "pending",
    2: "paid",
    3: "cancelled",
    4: "refunded",
    5: "pending",
    6: "failed",
  }

  return {
    ok: true as const,
    status: statusMap[result.orderStatus ?? -1] || "failed",
    amountRubles: typeof result.amount === "number" ? result.amount / 100 : undefined,
    orderNumber: result.orderNumber,
  }
}
