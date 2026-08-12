import { createHmac, timingSafeEqual } from "node:crypto"

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function secret() {
  const value = process.env.PAYLOAD_SECRET?.trim()
  if (!value) throw new Error("PAYLOAD_SECRET is required")
  return value
}

export function createOrderPaymentToken(orderId: string) {
  const payload = Buffer.from(JSON.stringify({ orderId, issuedAt: Date.now() })).toString("base64url")
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyOrderPaymentToken(token: string): string | null {
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  const expected = createHmac("sha256", secret()).update(payload).digest()
  const received = Buffer.from(signature, "base64url")
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { orderId?: string; issuedAt?: number }
    if (!parsed.orderId || !parsed.issuedAt || Date.now() - parsed.issuedAt > TOKEN_TTL_MS) return null
    return parsed.orderId
  } catch {
    return null
  }
}
