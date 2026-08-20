import { NextRequest, NextResponse } from "next/server"
import { getToken } from "@/lib/cdek"

const CDEK_API_URL = process.env.CDEK_API_URL || "https://api.cdek.ru/v2"
const CDEK_SENDER_CITY_CODE = Number(process.env.CDEK_SENDER_CITY_CODE || 437)
const OFFICE_PARAMS = new Set([
  "city_code", "country_codes", "region_code", "type", "postal_code", "code",
  "is_handout", "is_reception", "have_cashless", "have_cash", "allowed_cod",
  "is_dressing_room", "weight_min", "weight_max", "lang", "take_only",
])

function widgetHeaders() {
  return { "Content-Type": "application/json", "X-Service-Version": "3.11.1" }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("action") !== "offices") {
    return NextResponse.json({ message: "Unknown action" }, { status: 400, headers: widgetHeaders() })
  }

  try {
    const params = new URLSearchParams()
    request.nextUrl.searchParams.forEach((value, key) => {
      if (OFFICE_PARAMS.has(key)) params.set(key, value)
    })
    params.set("country_codes", "RU")
    params.set("is_handout", "true")

    const token = await getToken()
    const response = await fetch(`${CDEK_API_URL}/deliverypoints?${params}`, {
      headers: { Authorization: `Bearer ${token}`, "X-App-Name": "widget_pvz", "X-App-Version": "3.11.1" },
      cache: "no-store",
    })
    const body = await response.text()
    return new NextResponse(body, { status: response.status, headers: widgetHeaders() })
  } catch (error) {
    console.error("CDEK widget offices error:", error)
    return NextResponse.json({ message: "Не удалось загрузить пункты выдачи" }, { status: 502, headers: widgetHeaders() })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (body?.action !== "calculate") {
    return NextResponse.json({ message: "Unknown action" }, { status: 400, headers: widgetHeaders() })
  }

  const packages = Array.isArray(body.packages) ? body.packages.slice(0, 20) : []
  const toLocation = body.to_location && typeof body.to_location === "object" ? body.to_location : null
  if (!toLocation || packages.length === 0) {
    return NextResponse.json({ message: "Destination and packages are required" }, { status: 400, headers: widgetHeaders() })
  }

  try {
    const token = await getToken()
    const response = await fetch(`${CDEK_API_URL}/calculator/tarifflist`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-App-Name": "widget_pvz",
        "X-App-Version": "3.11.1",
      },
      body: JSON.stringify({
        ...body,
        action: undefined,
        from_location: { code: CDEK_SENDER_CITY_CODE },
        to_location: toLocation,
        packages,
      }),
      cache: "no-store",
    })
    const responseBody = await response.text()
    return new NextResponse(responseBody, { status: response.status, headers: widgetHeaders() })
  } catch (error) {
    console.error("CDEK widget calculation error:", error)
    return NextResponse.json({ message: "Не удалось рассчитать доставку" }, { status: 502, headers: widgetHeaders() })
  }
}
