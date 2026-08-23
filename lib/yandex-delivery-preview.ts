import "server-only"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { headers } from "next/headers"

/**
 * Temporary production access gate for the unfinished Yandex Delivery flow.
 *
 * `x-real-ip` is preferred because it is set by the reverse proxy. The first
 * `x-forwarded-for` value is used only when that header is unavailable.
 * The allow-list itself is environment configuration, so it is not baked into
 * a public client bundle or repository history.
 */
function requestClientIps(requestHeaders: Headers): string[] {
  const realIp = requestHeaders.get("x-real-ip")?.trim()
  const forwarded = requestHeaders.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) || []

  return [...new Set([...(realIp ? [realIp] : []), ...forwarded])]
}

export async function canUseYandexDeliveryPreview(): Promise<boolean> {
  const allowedIps = new Set(
    (process.env.YANDEX_DELIVERY_PREVIEW_ALLOWED_IPS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )

  const requestHeaders = await headers()
  if (requestClientIps(requestHeaders).some((ip) => allowedIps.has(ip))) return true

  const allowedAdminEmails = new Set(
    (process.env.YANDEX_DELIVERY_PREVIEW_ADMIN_EMAILS || "cactusjacklaflamerrr@gmail.com")
      .split(",")
      .map((value) => value.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  )
  if (allowedAdminEmails.size === 0) return false

  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: requestHeaders })
    const admin = user as { collection?: string; email?: string | null } | null
    return admin?.collection === "admins"
      && typeof admin.email === "string"
      && allowedAdminEmails.has(admin.email.toLocaleLowerCase("en-US"))
  } catch {
    return false
  }
}

export async function assertYandexDeliveryPreviewAccess(): Promise<void> {
  if (!await canUseYandexDeliveryPreview()) {
    throw new Error("Яндекс Доставка временно доступна только для тестирования")
  }
}
