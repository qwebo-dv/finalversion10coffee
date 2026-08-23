import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import configPromise from "@payload-config"
import { getMoyskladConfig } from "@/lib/moysklad/config"
import { retryFailedMoyskladOrders } from "@/lib/moysklad/order-retry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"

  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const config = getMoyskladConfig()
  if (!config.enabled || !config.syncOrdersOnCreate) {
    return NextResponse.json({ ok: true, skipped: true, reason: "MoySklad order sync is disabled" })
  }

  const payload = await getPayload({ config: configPromise })
  const result = await retryFailedMoyskladOrders(payload, {
    // Recover paid retail orders created while the integration was disabled or
    // before the queue status was set explicitly. Pending/error orders remain
    // part of the normal recurring sweep.
    includePaidDisabledRetail: true,
  })

  return NextResponse.json({ ok: result.failed === 0, ...result })
}
