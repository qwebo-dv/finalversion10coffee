const CDEK_API_URL = process.env.CDEK_API_URL || "https://api.cdek.ru/v2"
const CDEK_CLIENT_ID = process.env.CDEK_CLIENT_ID || ""
const CDEK_CLIENT_SECRET = process.env.CDEK_CLIENT_SECRET || ""
const CDEK_SENDER_CITY_CODE = parseInt(process.env.CDEK_SENDER_CITY_CODE || "437", 10)

// Token cache
let cachedToken: string | null = null
let tokenExpiresAt = 0

export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const res = await fetch(`${CDEK_API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CDEK_CLIENT_ID,
      client_secret: CDEK_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    throw new Error(`CDEK auth failed: ${res.status}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000
  return cachedToken!
}

export interface CdekCity {
  code: number
  city: string
  region: string
  country: string
}

export async function searchCities(query: string): Promise<CdekCity[]> {
  const token = await getToken()

  const params = new URLSearchParams({
    city: query,
    country_codes: "RU",
    size: "10",
  })

  const res = await fetch(`${CDEK_API_URL}/location/cities?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`CDEK cities search failed: ${res.status}`)
  }

  const data = await res.json()

  // Deduplicate by city code, keep first occurrence
  const seen = new Set<number>()
  return (data || [])
    .map((c: Record<string, unknown>) => ({
      code: c.code as number,
      city: c.city as string,
      region: c.region as string,
      country: c.country as string,
    }))
    .filter((c: CdekCity) => {
      if (seen.has(c.code)) return false
      seen.add(c.code)
      return true
    })
}

export interface CdekTariff {
  tariff_code: number
  tariff_name: string
  delivery_mode: number // 1=дверь-дверь, 2=дверь-склад, 3=склад-дверь, 4=склад-склад
  delivery_sum: number
  period_min: number
  period_max: number
}

export interface CdekPackageInput {
  weight: number
  length: number
  width: number
  height: number
}

export async function calculateTariff(
  toCityCode: number,
  packages: CdekPackageInput[],
): Promise<CdekTariff[]> {
  if (packages.length === 0) throw new Error("CDEK package list is empty")
  const token = await getToken()

  const res = await fetch(`${CDEK_API_URL}/calculator/tarifflist`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_location: { code: CDEK_SENDER_CITY_CODE },
      to_location: { code: toCityCode },
      packages,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CDEK tariff calculation failed: ${res.status} ${text}`)
  }

  const data = await res.json()

  if (data.errors?.length) {
    throw new Error(data.errors[0]?.message || "CDEK calculation error")
  }

  return (data.tariff_codes || []).map((t: Record<string, unknown>) => ({
    tariff_code: t.tariff_code as number,
    tariff_name: t.tariff_name as string,
    delivery_mode: t.delivery_mode as number,
    delivery_sum: t.delivery_sum as number,
    period_min: t.period_min as number,
    period_max: t.period_max as number,
  }))
}

export interface CdekOffice {
  code: string
  name: string
  address_full: string
  work_time: string
  type: string // PVZ or POSTAMAT
  location?: Record<string, unknown>
  country_code?: string
  have_cashless?: boolean
  have_cash?: boolean
  allowed_cod?: boolean
  is_dressing_room?: boolean
  dimensions?: unknown[] | null
  weight_min?: number
  weight_max?: number
}

export async function getDeliveryPoints(cityCode: number): Promise<CdekOffice[]> {
  const token = await getToken()

  const params = new URLSearchParams({
    city_code: String(cityCode),
    type: "PVZ",
    is_handout: "true",
  })

  const res = await fetch(`${CDEK_API_URL}/deliverypoints?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`CDEK delivery points failed: ${res.status}`)
  }

  const data = await res.json()

  return (data || []).map((p: Record<string, unknown>) => ({
    code: p.code as string,
    name: p.name as string,
    address_full: (p.location as Record<string, unknown>)?.address_full as string || (p.location as Record<string, unknown>)?.address as string || "",
    work_time: p.work_time as string || "",
    type: p.type as string || "PVZ",
    location: p.location as Record<string, unknown> || undefined,
    country_code: p.country_code as string || "RU",
    have_cashless: Boolean(p.have_cashless),
    have_cash: Boolean(p.have_cash),
    allowed_cod: Boolean(p.allowed_cod),
    is_dressing_room: Boolean(p.is_dressing_room),
    dimensions: p.dimensions as unknown[] | null || null,
    weight_min: Number(p.weight_min) || 0,
    weight_max: Number(p.weight_max) || 0,
  }))
}
