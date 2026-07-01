import { getMoyskladConfig, assertMoyskladReady, type MoyskladConfig } from "./config"
import type { MoyskladEntityType, MoyskladListResponse, MoyskladMeta } from "./types"

export class MoyskladApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = "MoyskladApiError"
  }
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "")
  const normalizedPath = path.replace(/^\/+/, "")
  return `${normalizedBase}/${normalizedPath}`
}

function buildAuthHeader(config: MoyskladConfig) {
  if (config.authMode === "bearer") {
    return `Bearer ${config.token}`
  }

  const raw = `${config.login}:${config.password}`
  return `Basic ${Buffer.from(raw).toString("base64")}`
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function moyskladRequest<T>(
  path: string,
  init: RequestInit = {},
  config = getMoyskladConfig()
): Promise<T> {
  assertMoyskladReady(config)

  const response = await fetch(joinUrl(config.baseUrl, path), {
    ...init,
    headers: {
      Accept: "application/json;charset=utf-8",
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(config),
      ...(init.headers || {}),
    },
    cache: "no-store",
  })

  const body = await parseResponse(response)

  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "errors" in body
      ? JSON.stringify((body as { errors?: unknown }).errors)
      : `MoySklad API error ${response.status}`
    throw new MoyskladApiError(message, response.status, body)
  }

  return body as T
}

export function moyskladMeta(type: MoyskladEntityType, id: string, config = getMoyskladConfig()): MoyskladMeta {
  const path = type === "state"
    ? `entity/customerorder/metadata/states/${id}`
    : `entity/${type}/${id}`

  return {
    href: joinUrl(config.baseUrl, path),
    type,
    mediaType: "application/json",
  }
}

export async function moyskladGetList<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return moyskladRequest<MoyskladListResponse<T>>(`${path}${query ? `?${query}` : ""}`)
}

export function extractMoyskladId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  const id = (value as { id?: unknown }).id
  if (typeof id === "string" && id) return id
  const meta = (value as { meta?: { href?: string } }).meta
  const href = meta?.href
  if (!href) return null
  return href.split("/").filter(Boolean).pop() || null
}
