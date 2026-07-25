"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"

export async function getSiteSettings() {
  try {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({ slug: "site-settings" })
    const typedSettings = settings as typeof settings & {
      priceListFile?: { url?: string; filename?: string } | string | number
      priceListUrl?: string
    }
    const uploadedPriceList =
      typeof typedSettings.priceListFile === "object"
        ? typedSettings.priceListFile
        : undefined

    return {
      ...typedSettings,
      // Keep the public API string-based so existing storefront components do
      // not need to know how Payload represents upload relationships.
      priceListUrl: uploadedPriceList?.url || typedSettings.priceListUrl,
      priceListFile: uploadedPriceList,
    } as typeof typedSettings & {
      loginAnnouncement?: string
      loginAnnouncementEnabled?: boolean
      priceListUrl?: string
      priceListFile?: { url?: string; filename?: string }
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
