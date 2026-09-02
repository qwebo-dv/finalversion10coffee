import { NextRequest, NextResponse } from "next/server"
import { formatLocalDadataAddress, getDadataAddressSuggestions } from "@/lib/dadata-address"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { query?: unknown; city?: unknown; region?: unknown } | null
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 200) : ""
  const city = typeof body?.city === "string" ? body.city.trim().slice(0, 100) : ""
  const region = typeof body?.region === "string" ? body.region.trim().slice(0, 100) : ""

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  if (!process.env.DADATA_API_KEY) {
    return NextResponse.json({ error: "Address suggestions are not configured" }, { status: 503 })
  }

  try {
    const data = await getDadataAddressSuggestions({ query, city, region })
    const suggestions = data.map((s) => ({
      value: city ? formatLocalDadataAddress(s) : s.value || "",
      label: s.value || "",
      unrestricted: s.unrestricted_value || "",
      city: s.data?.city || s.data?.settlement || "",
      region: s.data?.region || "",
      house: s.data?.house || "",
      houseFiasId: s.data?.house_fias_id || "",
      fiasLevel: s.data?.fias_level || "",
    }))
      .filter((suggestion) => suggestion.value && suggestion.label)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("DaData address suggestions error:", error)
    return NextResponse.json({ error: "Address suggestions are unavailable" }, { status: 502 })
  }
}
