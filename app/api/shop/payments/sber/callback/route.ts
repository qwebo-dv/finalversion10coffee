import { NextRequest, NextResponse } from "next/server"
import { refreshSberOrderPayment } from "@/lib/payments/sber-order-status"

export const dynamic = "force-dynamic"

async function handleCallback(request: NextRequest) {
  const url = new URL(request.url)
  let paymentId = url.searchParams.get("orderId") || url.searchParams.get("mdOrder") || ""

  if (!paymentId && request.method === "POST") {
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>
      paymentId = String(body.orderId || body.mdOrder || "")
    } else {
      const form = await request.formData().catch(() => null)
      paymentId = String(form?.get("orderId") || form?.get("mdOrder") || "")
    }
  }

  const result = await refreshSberOrderPayment(paymentId)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export async function GET(request: NextRequest) {
  return handleCallback(request)
}

export async function POST(request: NextRequest) {
  return handleCallback(request)
}
