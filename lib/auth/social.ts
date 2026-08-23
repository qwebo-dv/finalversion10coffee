import crypto from "crypto"
import { createRemoteJWKSet, jwtVerify } from "jose"

export type SocialProviderName = "yandex" | "vk" | "telegram"

export interface SocialProfile {
  provider: SocialProviderName
  providerId: string
  messagingId?: string
  email: string
  name: string
  avatarUrl: string
  phone?: string
}

interface ProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  clientIdEnv: string
  clientSecretEnv: string
  requiresClientSecret?: boolean
  requiresPkce: boolean
  scope: string
  usesBasicTokenAuth?: boolean
}

const PROVIDERS: Record<SocialProviderName, ProviderConfig> = {
  yandex: {
    authorizeUrl: "https://oauth.yandex.ru/authorize",
    tokenUrl: "https://oauth.yandex.ru/token",
    userInfoUrl: "https://login.yandex.ru/info",
    clientIdEnv: "YANDEX_CLIENT_ID",
    clientSecretEnv: "YANDEX_CLIENT_SECRET",
    requiresPkce: false,
    scope: "login:email login:info",
  },
  vk: {
    authorizeUrl: "https://id.vk.com/authorize",
    tokenUrl: "https://id.vk.com/oauth2/auth",
    userInfoUrl: "https://id.vk.com/oauth2/user_info",
    clientIdEnv: "VK_CLIENT_ID",
    clientSecretEnv: "VK_CLIENT_SECRET",
    requiresClientSecret: false,
    requiresPkce: true,
    scope: "email",
  },
  telegram: {
    authorizeUrl: "https://oauth.telegram.org/auth",
    tokenUrl: "https://oauth.telegram.org/token",
    userInfoUrl: "",
    clientIdEnv: "TELEGRAM_CLIENT_ID",
    clientSecretEnv: "TELEGRAM_CLIENT_SECRET",
    requiresPkce: true,
    scope: "openid profile phone telegram:bot_access",
    usesBasicTokenAuth: true,
  },
}

const TELEGRAM_ISSUER = "https://oauth.telegram.org"
const telegramJwks = createRemoteJWKSet(new URL(`${TELEGRAM_ISSUER}/.well-known/jwks.json`))

export function getSocialProvider(name: string): SocialProviderName | null {
  return name === "yandex" || name === "vk" || name === "telegram" ? name : null
}

export function getSocialProviderConfig(name: SocialProviderName) {
  return PROVIDERS[name]
}

export function isSocialProviderConfigured(name: SocialProviderName): boolean {
  const config = PROVIDERS[name]
  return Boolean(
    process.env[config.clientIdEnv]?.trim() &&
      (!config.requiresClientSecret || process.env[config.clientSecretEnv]?.trim())
  )
}

export function getConfiguredSocialProviders(): SocialProviderName[] {
  return (Object.keys(PROVIDERS) as SocialProviderName[]).filter(
    isSocialProviderConfigured
  )
}

export function getSocialRedirectUri(): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "")
  return `${base}/api/auth/social/callback`
}

export function randomOAuthState(length = 32): string {
  return crypto.randomBytes(length).toString("base64url")
}

export function randomCodeVerifier(): string {
  return crypto.randomBytes(48).toString("base64url")
}

export function codeChallengeFromVerifier(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest("base64url")
  return hash.replace(/=+$/, "")
}

export function buildAuthorizeUrl(params: {
  provider: SocialProviderName
  state: string
  codeChallenge?: string
  returnTo?: string
}): string {
  const { provider, state, codeChallenge } = params
  const config = PROVIDERS[provider]
  const clientId = process.env[config.clientIdEnv] || ""
  const redirectUri = getSocialRedirectUri()
  const url = new URL(config.authorizeUrl)
  const query: Record<string, string> = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: config.scope,
  }

  if (config.requiresPkce && codeChallenge) {
    query.code_challenge = codeChallenge
    query.code_challenge_method = "S256"
    query.prompt = "login"
  }

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return url.toString()
}

async function postForm(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body),
  })
  const text = await response.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`OAuth: неожиданный ответ от ${url} (${response.status}): ${text.slice(0, 300)}`)
  }
  if (!response.ok || json.error) {
    throw new Error(
      `OAuth: ошибка обмена кода (${response.status}): ${String(json.error_description || json.error || "unknown")}`
    )
  }
  return json
}

export async function exchangeCodeForToken(params: {
  provider: SocialProviderName
  code: string
  codeVerifier?: string
  state?: string
  deviceId?: string
}): Promise<{ accessToken: string; idToken?: string }> {
  const { provider, code } = params
  const config = PROVIDERS[provider]
  const clientId = process.env[config.clientIdEnv] || ""
  const clientSecret = process.env[config.clientSecretEnv] || ""
  const redirectUri = getSocialRedirectUri()

  let result: Record<string, unknown>

  if (provider === "vk") {
    if (!params.deviceId) {
      throw new Error("OAuth VK: device_id не получен")
    }

    const query = new URLSearchParams({
      code_verifier: params.codeVerifier || "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      client_id: clientId,
      device_id: params.deviceId,
    })
    if (params.state) query.set("state", params.state)

    const response = await fetch(
      `https://id.vk.com/oauth2/auth?${query.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ code }).toString(),
      }
    )
    const text = await response.text()
    let json: Record<string, unknown>
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`OAuth VK: неожиданный ответ (${response.status}): ${text.slice(0, 300)}`)
    }
    if (!response.ok || json.error) {
      throw new Error(
        `OAuth VK: ${String(json.error_description || json.error || "unknown")}`
      )
    }
    result = json
  } else if (config.usesBasicTokenAuth) {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: params.codeVerifier || "",
      }),
    })
    const text = await response.text()
    try {
      result = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new Error(`OAuth Telegram: неожиданный ответ (${response.status}): ${text.slice(0, 300)}`)
    }
    if (!response.ok || result.error) {
      throw new Error(`OAuth Telegram: ${String(result.error_description || result.error || "unknown")}`)
    }
  } else {
    result = await postForm(config.tokenUrl, {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    })
  }

  const accessToken = typeof result.access_token === "string" ? result.access_token : ""
  if (!accessToken) {
    throw new Error("OAuth: access_token не получен")
  }

  return {
    accessToken,
    idToken: typeof result.id_token === "string" ? result.id_token : undefined,
  }
}

async function fetchYandexProfile(accessToken: string): Promise<SocialProfile> {
  const response = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${accessToken}` },
  })
  if (!response.ok) throw new Error(`OAuth Yandex: userinfo ${response.status}`)
  const data = (await response.json()) as {
    id?: string
    default_email?: string
    emails?: string[]
    first_name?: string
    last_name?: string
    display_name?: string
    default_avatar_id?: string
  }

  const email = data.default_email || data.emails?.[0] || ""
  if (!email) throw new Error("OAuth Yandex: email не получен")

  return {
    provider: "yandex",
    providerId: String(data.id || ""),
    email,
    name: data.display_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || "",
    avatarUrl: data.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
      : "",
  }
}

async function fetchVkProfile(accessToken: string): Promise<SocialProfile> {
  const clientId = process.env[PROVIDERS.vk.clientIdEnv] || ""
  const response = await fetch(
    `https://id.vk.com/oauth2/user_info?client_id=${encodeURIComponent(clientId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ access_token: accessToken }),
    }
  )
  if (!response.ok) throw new Error(`OAuth VK: userinfo ${response.status}`)
  const data = (await response.json()) as {
    user?: {
      user_id?: string | number
      first_name?: string
      last_name?: string
      avatar?: string
      email?: string
      phone?: string
    }
  }
  const user = data.user || {}
  const email = user.email || ""
  if (!email) throw new Error("OAuth VK: email не получен")

  return {
    provider: "vk",
    providerId: String(user.user_id || ""),
    email,
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "",
    avatarUrl: user.avatar || "",
    phone: user.phone || "",
  }
}

async function fetchTelegramProfile(idToken: string): Promise<SocialProfile> {
  const clientId = process.env[PROVIDERS.telegram.clientIdEnv] || ""
  if (!clientId) throw new Error("OAuth Telegram: client ID не настроен")

  const { payload } = await jwtVerify(idToken, telegramJwks, {
    issuer: TELEGRAM_ISSUER,
    audience: clientId,
    algorithms: ["RS256"],
  })
  const providerId = typeof payload.sub === "string" ? payload.sub : ""
  if (!providerId) throw new Error("OAuth Telegram: идентификатор пользователя не получен")
  const messagingId = typeof payload.id === "number" || typeof payload.id === "string"
    ? String(payload.id)
    : ""

  const name = typeof payload.name === "string"
    ? payload.name
    : typeof payload.preferred_username === "string"
      ? payload.preferred_username
      : "Покупатель"
  const rawPhone = payload.phone_number_verified === true && typeof payload.phone_number === "string"
    ? payload.phone_number
    : ""

  return {
    provider: "telegram",
    providerId,
    messagingId: messagingId || undefined,
    // Telegram OIDC does not return email. The value is an internal account
    // identifier, not a customer contact address, and is never prefilled at checkout.
    email: `telegram-${providerId}@auth.10coffee.local`,
    name,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : "",
    phone: rawPhone ? (rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`) : "",
  }
}

export async function fetchSocialProfile(
  provider: SocialProviderName,
  tokens: { accessToken: string; idToken?: string }
): Promise<SocialProfile> {
  if (provider === "yandex") return fetchYandexProfile(tokens.accessToken)
  if (provider === "vk") return fetchVkProfile(tokens.accessToken)
  if (!tokens.idToken) throw new Error("OAuth Telegram: id_token не получен")
  return fetchTelegramProfile(tokens.idToken)
}
