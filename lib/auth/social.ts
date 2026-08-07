import crypto from "crypto"

export type SocialProviderName = "yandex" | "vk" | "sberid"

export interface SocialProfile {
  provider: SocialProviderName
  providerId: string
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
  requiresPkce: boolean
  scope: string
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
    requiresPkce: true,
    scope: "email",
  },
  sberid: {
    authorizeUrl:
      process.env.SBER_AUTH_URL || "https://id.sber.ru/CSAFront/oidc/authorize.do",
    tokenUrl: process.env.SBER_TOKEN_URL || "https://oauth.sber.ru/ru/prod/tokens/v2/oidc",
    userInfoUrl:
      process.env.SBER_USERINFO_URL || "https://oauth.sber.ru/ru/prod/sberbankid/v2.1/userinfo",
    clientIdEnv: "SBER_CLIENT_ID",
    clientSecretEnv: "SBER_CLIENT_SECRET",
    requiresPkce: false,
    scope: "openid email mobile name",
  },
}

export function getSocialProvider(name: string): SocialProviderName | null {
  return name === "yandex" || name === "vk" || name === "sberid" ? name : null
}

export function getSocialProviderConfig(name: SocialProviderName) {
  return PROVIDERS[name]
}

export function isSocialProviderConfigured(name: SocialProviderName): boolean {
  const config = PROVIDERS[name]
  return Boolean(
    process.env[config.clientIdEnv]?.trim() &&
      process.env[config.clientSecretEnv]?.trim()
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

  if (provider === "sberid") {
    query.nonce = randomOAuthState(32)
    query.channel = "browser"
    query.isCloud = "true"
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
}): Promise<{ accessToken: string; idToken?: string }> {
  const { provider, code } = params
  const config = PROVIDERS[provider]
  const clientId = process.env[config.clientIdEnv] || ""
  const clientSecret = process.env[config.clientSecretEnv] || ""
  const redirectUri = getSocialRedirectUri()

  let result: Record<string, unknown>

  if (provider === "vk") {
    const body = new URLSearchParams({
      code,
      code_verifier: params.codeVerifier || "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      client_id: clientId,
    })
    if (params.state) body.set("state", params.state)

    const response = await fetch(
      `https://id.vk.com/oauth2/auth?${body.toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
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
  } else if (provider === "sberid") {
    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }
    if (params.state) body.state = params.state
    result = await postForm(config.tokenUrl, body)
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

async function fetchSberIdProfile(accessToken: string): Promise<SocialProfile> {
  const requestId = crypto.randomUUID().replace(/-/g, "")
  const response = await fetch(PROVIDERS.sberid.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-introspect-rquid": requestId,
      Accept: "application/json",
    },
  })
  if (!response.ok) throw new Error(`OAuth Sber ID: userinfo ${response.status}`)
  const data = (await response.json()) as {
    sub?: string
    email?: string
    family_name?: string
    given_name?: string
    middle_name?: string
    phone_number?: string
  }

  const email = data.email || ""
  if (!email) throw new Error("OAuth Sber ID: email не получен")

  return {
    provider: "sberid",
    providerId: String(data.sub || ""),
    email,
    name: [data.family_name, data.given_name, data.middle_name]
      .filter(Boolean)
      .join(" ") || "",
    avatarUrl: "",
    phone: data.phone_number || "",
  }
}

export async function fetchSocialProfile(
  provider: SocialProviderName,
  accessToken: string
): Promise<SocialProfile> {
  if (provider === "yandex") return fetchYandexProfile(accessToken)
  if (provider === "vk") return fetchVkProfile(accessToken)
  return fetchSberIdProfile(accessToken)
}
