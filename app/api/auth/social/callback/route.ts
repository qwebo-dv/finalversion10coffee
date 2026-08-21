import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { dbQuery } from "@/lib/db"
import {
  exchangeCodeForToken,
  fetchSocialProfile,
  getSocialProvider,
  type SocialProfile,
} from "@/lib/auth/social"
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/social-constants"
import {
  createSession,
  getCurrentUser,
  getUserBySocialIdentity,
  linkSocialIdentity,
  shouldUseSecureCookies,
  upsertAuthUser,
} from "@/lib/auth/local"

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000"
  )
}

function errorRedirect(reason: string) {
  return NextResponse.redirect(
    new URL(`/?auth=login&social_error=${encodeURIComponent(reason)}`, getBaseUrl())
  )
}

function linkErrorRedirect(
  customerType: "individual" | "business",
  provider: string,
  reason: string,
  canTransfer: boolean
) {
  const basePath = customerType === "individual" ? "/main/settings" : "/dashboard/settings"
  const params = new URLSearchParams({ social_error: reason })
  if (canTransfer) params.set("social_transfer", provider)
  return NextResponse.redirect(new URL(`${basePath}?${params.toString()}`, getBaseUrl()))
}

async function syncClientProfile(userId: string, profile: SocialProfile) {
  await dbQuery(
    `insert into public.client_profiles (id, email, full_name, phone, created_at, updated_at)
     values ($1, $2, $3, $4, now(), now())
     on conflict (id) do update
        set email = excluded.email,
            full_name = excluded.full_name,
            phone = coalesce(excluded.phone, client_profiles.phone),
            updated_at = now()`,
    [userId, profile.email, profile.name, profile.phone || ""]
  )

  try {
    const { getPayload } = await import("payload")
    const payloadConfig = await import("@payload-config")
    const payload = await getPayload({ config: payloadConfig.default })

    const { docs } = await payload.find({
      collection: "clients",
      where: {
        or: [
          { supabaseId: { equals: userId } },
          { email: { equals: profile.email } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    if (docs[0]?.id) {
      await payload.update({
        collection: "clients",
        id: docs[0].id,
        data: {
          fullName: profile.name,
          email: profile.email,
          phone: profile.phone || "",
        },
      })
    } else {
      await payload.create({
        collection: "clients",
        data: {
          fullName: profile.name,
          email: profile.email,
          phone: profile.phone || "",
          supabaseId: userId,
          customerType: "individual",
          salesChannel: "retail",
        },
      })
    }
  } catch (syncError) {
    console.error("Failed to sync social client to Payload:", syncError)
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const stateParam = searchParams.get("state")
  const deviceId = searchParams.get("device_id")
  const errorParam = searchParams.get("error")

  if (errorParam) {
    return errorRedirect(`Провайдер вернул ошибку: ${errorParam}`)
  }

  if (!code || !stateParam) {
    return errorRedirect("Недостаточно параметров авторизации")
  }

  const storedRaw = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value
  if (!storedRaw) {
    return errorRedirect("Состояние авторизации не найдено")
  }

  let stored: {
    state?: string
    codeVerifier?: string | null
    provider?: string
    customerType?: "individual" | "business"
    linkUserId?: string | null
    allowTransfer?: boolean
    expiresAt?: number
  }
  try {
    stored = JSON.parse(storedRaw)
  } catch {
    return errorRedirect("Некорректное состояние авторизации")
  }

  if (!stored.state || stored.state !== stateParam) {
    return errorRedirect("Проверка state не пройдена")
  }
  if (stored.expiresAt && Date.now() > stored.expiresAt) {
    return errorRedirect("Время авторизации истекло")
  }

  const providerName = getSocialProvider(stored.provider || "")
  if (!providerName) {
    return errorRedirect("Неизвестный провайдер авторизации")
  }

  try {
    const tokens = await exchangeCodeForToken({
      provider: providerName,
      code,
      codeVerifier: stored.codeVerifier || undefined,
      state: stateParam,
      deviceId: deviceId || undefined,
    })

    const profile = await fetchSocialProfile(providerName, tokens)

    const customerType = stored.customerType || "individual"
    const sessionUser = stored.linkUserId
      ? await getCurrentUser(customerType)
      : null
    if (stored.linkUserId && sessionUser?.id !== stored.linkUserId) {
      return errorRedirect("Сессия для привязки способа входа не найдена")
    }

    let user = sessionUser || await getUserBySocialIdentity(profile.provider, profile.providerId)
    let created = false

    if (!user) {
      const result = await upsertAuthUser({
        email: profile.email,
        password: cryptoRandomPassword(),
        metadata: {
          user_type: "client",
          customer_type: customerType,
          full_name: profile.name,
          avatar_url: profile.avatarUrl || "",
          phone: profile.phone || "",
          email_verified: profile.provider !== "telegram",
          email_is_placeholder: profile.provider === "telegram",
          auth_provider: profile.provider,
        },
      })
      user = result.user
      created = result.created
    }

    await linkSocialIdentity({
      userId: user.id,
      provider: profile.provider,
      providerUserId: profile.providerId,
      allowTransfer: stored.allowTransfer === true,
    })

    if (created) {
      await syncClientProfile(user.id, profile)
    }

    await createSession(user.id, customerType)

    const destination = stored.linkUserId
      ? customerType === "individual"
        ? `/main/settings?social_linked=${encodeURIComponent(providerName)}`
        : `/dashboard/settings?social_linked=${encodeURIComponent(providerName)}`
      : customerType === "individual"
        ? "/main"
        : "/dashboard"
    const response = NextResponse.redirect(new URL(destination, getBaseUrl()))
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      maxAge: 0,
    })
    return response
  } catch (error) {
    console.error("Social callback error:", error)
    const reason = error instanceof Error ? error.message : "Ошибка авторизации"
    const customerType = stored.customerType || "individual"
    if (stored.linkUserId) {
      return linkErrorRedirect(
        customerType,
        providerName,
        reason,
        reason.includes("уже привязан к другому аккаунту")
      )
    }
    return errorRedirect(reason)
  }
}

function cryptoRandomPassword(length = 24): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%"
  return Array.from(crypto.randomBytes(length))
    .map((byte) => chars[byte % chars.length])
    .join("")
}
