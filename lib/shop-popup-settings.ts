import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { getPayload } from "payload"
import configPromise from "@payload-config"

export interface ShopPopupContent {
  enabled: boolean
  campaignVersion: number
  badgeText: string
  title: string
  descriptionHtml: string
  promoCode: string
  ctaLabel: string
  declineLabel: string
  visualMode: "coffee" | "image"
  visualImageUrl: string | null
  visualCaption: string
}

export const DEFAULT_SHOP_POPUP: ShopPopupContent = {
  enabled: false,
  campaignVersion: 1,
  badgeText: "Предложение для нового покупателя",
  title: "Дарим 10% на первый заказ и бонусы за каждый следующий",
  descriptionHtml: "<p>Зарегистрируйтесь в личном кабинете 10coffee, используйте промокод <strong>10COFFEE</strong>, копите бонусы с покупок и оплачивайте ими новые заказы.</p>",
  promoCode: "10COFFEE",
  ctaLabel: "Получить скидку 10% и зарегистрироваться",
  declineLabel: "Нет, спасибо, я предпочитаю платить полную цену",
  visualMode: "coffee",
  visualImageUrl: null,
  visualCaption: "Свежая обжарка · бонусы с каждой покупки",
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function descriptionHtml(value: unknown): string {
  if (!value || typeof value !== "object") return DEFAULT_SHOP_POPUP.descriptionHtml
  try {
    return convertLexicalToHTML({ data: value as SerializedEditorState }) || DEFAULT_SHOP_POPUP.descriptionHtml
  } catch (error) {
    console.error("[shop-popup] Не удалось преобразовать текст баннера", error)
    return DEFAULT_SHOP_POPUP.descriptionHtml
  }
}

export async function getShopPopupSettings(): Promise<ShopPopupContent> {
  try {
    const payload = await getPayload({ config: configPromise })
    const settings = await payload.findGlobal({ slug: "shop-popup-settings", depth: 1 })
    const image = settings.visualImage
    const imageUrl = image && typeof image === "object" && "url" in image && typeof image.url === "string" ? image.url : null

    return {
      enabled: settings.enabled !== false,
      campaignVersion: Math.max(1, Number(settings.campaignVersion) || 1),
      badgeText: text(settings.badgeText, DEFAULT_SHOP_POPUP.badgeText),
      title: text(settings.title, DEFAULT_SHOP_POPUP.title).replace(/\s*☕\uFE0F?\s*$/u, ""),
      descriptionHtml: descriptionHtml(settings.description),
      promoCode: text(settings.promoCode, DEFAULT_SHOP_POPUP.promoCode).toUpperCase(),
      ctaLabel: text(settings.ctaLabel, DEFAULT_SHOP_POPUP.ctaLabel),
      declineLabel: text(settings.declineLabel, DEFAULT_SHOP_POPUP.declineLabel),
      visualMode: settings.visualMode === "image" ? "image" : "coffee",
      visualImageUrl: imageUrl,
      visualCaption: text(settings.visualCaption, DEFAULT_SHOP_POPUP.visualCaption),
    }
  } catch (error) {
    console.error("[shop-popup] Настройки недоступны, используются безопасные значения по умолчанию", error)
    return DEFAULT_SHOP_POPUP
  }
}
