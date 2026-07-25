"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"

export async function getSiteSettings() {
  try {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({ slug: "site-settings" })
    const typedSettings = settings as typeof settings & {
      priceListUrl?: string
      priceListForm?: {
        emailFile?: { url?: string; filename?: string } | string | number
        senderName?: string
        senderPosition?: string
        senderPhone?: string
        senderTelegram?: string
      }
    }
    const uploadedPriceList =
      typeof typedSettings.priceListForm?.emailFile === "object"
        ? typedSettings.priceListForm.emailFile
        : undefined

    return {
      ...typedSettings,
      // Keep the public API string-based so existing storefront components do
      // not need to know how Payload represents upload relationships.
      priceListUrl: uploadedPriceList?.url || typedSettings.priceListUrl,
    } as typeof typedSettings & {
      loginAnnouncement?: string
      loginAnnouncementEnabled?: boolean
      priceListUrl?: string
      priceListForm?: {
        emailFile?: { url?: string; filename?: string }
        senderName?: string
        senderPosition?: string
        senderPhone?: string
        senderTelegram?: string
      }
    }
  } catch {
    return null
  }
}
