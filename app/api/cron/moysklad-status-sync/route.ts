import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import configPromise from "@payload-config"
import { getMoyskladConfig } from "@/lib/moysklad/config"
import { syncMoyskladOrderStatuses } from "@/lib/moysklad/status-sync"

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

  if (!getMoyskladConfig().enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "MoySklad sync is disabled" })
  }

  const payload = await getPayload({ config: configPromise })
  const result = await syncMoyskladOrderStatuses(payload, { limit: 500 })
  return NextResponse.json(result)
}
