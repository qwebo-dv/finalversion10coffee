import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import configPromise from "@payload-config"
import { reconcileDeliveredLoyaltyOrders } from "@/lib/loyalty"
import { reconcilePendingYooKassaPayments } from "@/lib/payments/yookassa-order-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  try {
    const payload = await getPayload({ config: configPromise })
    const payments = await reconcilePendingYooKassaPayments()
    const loyalty = await reconcileDeliveredLoyaltyOrders(payload)
    return NextResponse.json({ ok: true, payments, loyalty })
  } catch (error) {
    console.error("[loyalty-accrual-reconcile] failed", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Reconciliation failed" }, { status: 500 })
  }
}
