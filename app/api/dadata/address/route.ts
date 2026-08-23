import { NextRequest, NextResponse } from "next/server"

interface DadataSuggestion {
  value?: string
  unrestricted_value?: string
  data?: {
    city?: string | null
    settlement?: string | null
    region?: string | null
    street_with_type?: string | null
    house_type?: string | null
    house?: string | null
    block_type?: string | null
    block?: string | null
    flat_type?: string | null
    flat?: string | null
  }
}

function localAddress(suggestion: DadataSuggestion): string {
  const data = suggestion.data
  if (!data?.street_with_type) return suggestion.value || ""
  return [
    data.street_with_type,
    data.house ? `${data.house_type || "д"} ${data.house}` : "",
    data.block ? `${data.block_type || "корп"} ${data.block}` : "",
    data.flat ? `${data.flat_type || "кв"} ${data.flat}` : "",
  ].filter(Boolean).join(", ")
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { query?: unknown; city?: unknown; region?: unknown } | null
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 200) : ""
  const city = typeof body?.city === "string" ? body.city.trim().slice(0, 100) : ""
  const region = typeof body?.region === "string" ? body.region.trim().slice(0, 100) : ""

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const apiKey = process.env.DADATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Address suggestions are not configured" }, { status: 503 })
  }

  try {
    const response = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          count: 5,
          ...(city || region ? {
            from_bound: { value: "street" },
            to_bound: { value: "house" },
            locations: [city ? { city } : { region }],
          } : {}),
        }),
      }
    )

    if (!response.ok) {
      console.error("DaData address suggestions failed:", response.status)
      return NextResponse.json({ error: "Address suggestions are unavailable" }, { status: 502 })
    }

    const data = await response.json() as { suggestions?: DadataSuggestion[] }
    const suggestions = ((data.suggestions || []) as DadataSuggestion[]).map((s) => ({
      value: city ? localAddress(s) : s.value || "",
      label: s.value || "",
      unrestricted: s.unrestricted_value || "",
      city: s.data?.city || s.data?.settlement || "",
      region: s.data?.region || "",
    }))
      .filter((suggestion) => suggestion.value && suggestion.label)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("DaData address suggestions error:", error)
    return NextResponse.json({ error: "Address suggestions are unavailable" }, { status: 502 })
  }
}
