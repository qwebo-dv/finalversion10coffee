import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import configPromise from "@payload-config"
import { expireLoyaltyPoints } from "@/lib/loyalty"

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
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await expireLoyaltyPoints(payload)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[loyalty-expiry] failed", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Expiry processing failed" }, { status: 500 })
  }
}
