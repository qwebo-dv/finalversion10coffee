export interface DadataAddressSuggestion {
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
    house_fias_id?: string | null
    fias_level?: string | null
    geo_lat?: string | null
    geo_lon?: string | null
  }
}

export function formatLocalDadataAddress(suggestion: DadataAddressSuggestion): string {
  const data = suggestion.data
  if (!data?.street_with_type) return suggestion.value || ""
  return [
    data.street_with_type,
    data.house ? `${data.house_type || "д"} ${data.house}` : "",
    data.block ? `${data.block_type || "корп"} ${data.block}` : "",
    data.flat ? `${data.flat_type || "кв"} ${data.flat}` : "",
  ].filter(Boolean).join(", ")
}

export function dadataSuggestionHasHouse(suggestion: DadataAddressSuggestion): boolean {
  return Boolean(suggestion.data?.house?.trim())
}

export async function getDadataAddressSuggestions({
  query,
  city,
  region,
  count = 5,
}: {
  query: string
  city?: string
  region?: string
  count?: number
}): Promise<DadataAddressSuggestion[]> {
  const apiKey = process.env.DADATA_API_KEY
  if (!apiKey) throw new Error("DADATA_API_KEY is not configured")

  const normalizedQuery = query.trim().slice(0, 300)
  const normalizedCity = city?.trim().slice(0, 100) || ""
  const normalizedRegion = region?.trim().slice(0, 100) || ""
  const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Token ${apiKey}`,
    },
    body: JSON.stringify({
      query: normalizedQuery,
      count,
      from_bound: { value: "street" },
      to_bound: { value: "house" },
      ...(normalizedCity || normalizedRegion ? {
        locations: [normalizedCity ? { city: normalizedCity } : { region: normalizedRegion }],
      } : {}),
    }),
    cache: "no-store",
  })

  if (!response.ok) throw new Error(`DaData address suggestions failed: ${response.status}`)
  const body = await response.json() as { suggestions?: DadataAddressSuggestion[] }
  return Array.isArray(body.suggestions) ? body.suggestions : []
}

function normalizeAddress(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/[^а-яёa-z0-9]/g, "")
}

export function dadataSuggestionsMatchAddressWithHouse(
  address: string,
  suggestions: DadataAddressSuggestion[],
): boolean {
  const normalizedAddress = normalizeAddress(address)
  if (normalizedAddress.length < 4) return false

  return suggestions.some((suggestion) => {
    if (!dadataSuggestionHasHouse(suggestion)) return false
    const candidates = [
      suggestion.value || "",
      suggestion.unrestricted_value || "",
      formatLocalDadataAddress(suggestion),
    ].map(normalizeAddress).filter(Boolean)

    return candidates.some((candidate) =>
      candidate === normalizedAddress
      || candidate.endsWith(normalizedAddress)
      || normalizedAddress.endsWith(candidate)
    )
  })
}

export async function validateDadataAddressHasHouse({
  address,
  city,
  region,
}: {
  address: string
  city?: string
  region?: string
}): Promise<boolean> {
  const suggestions = await getDadataAddressSuggestions({ query: address, city, region })
  return dadataSuggestionsMatchAddressWithHouse(address, suggestions)
}
