import { NextRequest, NextResponse } from "next/server"
import {
  buildAuthorizeUrl,
  getSocialProvider,
  getSocialProviderConfig,
  isSocialProviderConfigured,
  codeChallengeFromVerifier,
  randomCodeVerifier,
  randomOAuthState,
} from "@/lib/auth/social"
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/social-constants"
import { shouldUseSecureCookies } from "@/lib/auth/local"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const customerType = request.nextUrl.searchParams.get("customer_type") === "business"
    ? "business"
    : "individual"
  const providerName = getSocialProvider(provider)

  if (!providerName) {
    return NextResponse.redirect(
      new URL("/?auth=login&social_error=unknown_provider", getBaseUrl())
    )
  }

  if (!isSocialProviderConfigured(providerName)) {
    return NextResponse.redirect(
      new URL("/?auth=login&social_error=not_configured", getBaseUrl())
    )
  }

  const config = getSocialProviderConfig(providerName)
  const state = randomOAuthState()
  const codeVerifier = config.requiresPkce ? randomCodeVerifier() : undefined
  const codeChallenge = codeVerifier ? codeChallengeFromVerifier(codeVerifier) : undefined

  const authorizeUrl = buildAuthorizeUrl({
    provider: providerName,
    state,
    codeChallenge,
  })

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(
    OAUTH_STATE_COOKIE_NAME,
    JSON.stringify({
      state,
      codeVerifier: codeVerifier || null,
      provider: providerName,
      customerType,
      expiresAt: Date.now() + 10 * 60 * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      maxAge: 600,
    }
  )

  return response
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000"
  )
}
