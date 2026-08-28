import { getPayload } from "payload"
import configPromise from "@payload-config"
import {
  DEFAULT_SHOP_TICKER,
  type ShopTickerContent,
  type ShopTickerFontPreset,
} from "@/lib/shop-ticker-config"

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : fallback
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function fontPreset(value: unknown): ShopTickerFontPreset {
  return value === "site" || value === "monospace" ? value : "pixel"
}

export async function getShopTickerSettings(): Promise<ShopTickerContent> {
  try {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({ slug: "shop-ticker-settings", depth: 0 })
    const items = Array.isArray(settings.items)
      ? settings.items
          .map((item) => ({
            text: typeof item?.text === "string" ? item.text.trim() : "",
            highlighted: item?.highlighted === true,
          }))
          .filter((item) => item.text)
      : []

    return {
      enabled: settings.enabled !== false,
      items: items.length ? items : DEFAULT_SHOP_TICKER.items,
      backgroundColor: color(settings.backgroundColor, DEFAULT_SHOP_TICKER.backgroundColor),
      textColor: color(settings.textColor, DEFAULT_SHOP_TICKER.textColor),
      markerColor: color(settings.markerColor, DEFAULT_SHOP_TICKER.markerColor),
      highlightColor: color(settings.highlightColor, DEFAULT_SHOP_TICKER.highlightColor),
      fontPreset: fontPreset(settings.fontPreset),
      desktopFontSize: numberInRange(settings.desktopFontSize, DEFAULT_SHOP_TICKER.desktopFontSize, 6, 24),
      mobileFontSize: numberInRange(settings.mobileFontSize, DEFAULT_SHOP_TICKER.mobileFontSize, 6, 20),
      speedSeconds: numberInRange(settings.speedSeconds, DEFAULT_SHOP_TICKER.speedSeconds, 10, 300),
      marker: typeof settings.marker === "string" && settings.marker.trim() ? settings.marker.trim().slice(0, 4) : DEFAULT_SHOP_TICKER.marker,
      uppercase: settings.uppercase !== false,
      pauseOnHover: settings.pauseOnHover !== false,
    }
  } catch (error) {
    console.error("[shop-ticker] Настройки недоступны, используются безопасные значения по умолчанию", error)
    return DEFAULT_SHOP_TICKER
  }
}
