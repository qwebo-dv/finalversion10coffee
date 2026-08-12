import { NextRequest, NextResponse } from "next/server"
import { refreshYooKassaOrderPayment } from "@/lib/payments/yookassa-order-status"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { event?: string; object?: { id?: string } } | null
  if (!body?.object?.id || !["payment.succeeded", "payment.canceled"].includes(body.event || "")) {
    return NextResponse.json({ ok: false, error: "Некорректное уведомление" }, { status: 400 })
  }
  const result = await refreshYooKassaOrderPayment(body.object.id, "payment")
  if (result.ok && result.status === "paid" && result.confirmationEmailSent === false) {
    // Ask YooKassa to retry the notification. Payment state is already stored,
    // and email delivery is idempotent, so a retry is safe.
    return NextResponse.json({ ok: false, error: "Не отправлено подтверждение оплаты" }, { status: 502 })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
