import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { inn: rawInn } = await request.json()
  const inn = typeof rawInn === "string" ? rawInn.replace(/\D/g, "").slice(0, 12) : ""

  if (inn.length < 10) {
    return NextResponse.json({ error: "Введите корректный ИНН" }, { status: 400 })
  }

  const apiKey = process.env.DADATA_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "DaData API ключ не настроен" },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({ query: inn }),
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: "Ошибка при запросе к DaData" },
        { status: response.status }
      )
    }

    const data = await response.json()
    const suggestion = data.suggestions?.[0]

    if (!suggestion) {
      return NextResponse.json({ error: "Компания не найдена" }, { status: 404 })
    }

    return NextResponse.json({
      name: suggestion.value,
      inn: suggestion.data.inn,
      kpp: suggestion.data.kpp,
      ogrn: suggestion.data.ogrn,
      address: suggestion.data.address?.unrestricted_value || "",
      management_name: suggestion.data.management?.name || "",
    })
  } catch {
    return NextResponse.json(
      { error: "Ошибка при подключении к DaData" },
      { status: 500 }
    )
  }
}
