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
  appearance: ShopPopupAppearance
}

export interface ShopPopupAppearance {
  titleDesktopFontSize: number
  titleMobileFontSize: number
  descriptionDesktopFontSize: number
  descriptionMobileFontSize: number
  buttonDesktopFontSize: number
  buttonMobileFontSize: number
  badgeFontSize: number
  declineFontSize: number
  visualCaptionFontSize: number
  promoCodeFontSize: number
  panelBackgroundColor: string
  titleColor: string
  accentColor: string
  descriptionColor: string
  badgeBackgroundColor: string
  badgeTextColor: string
  buttonBackgroundColor: string
  buttonTextColor: string
  declineTextColor: string
  visualTextColor: string
  visualBackgroundColor: string
  visualGlowColor: string
  promoPlateBackgroundColor: string
  promoPlateTextColor: string
}

export const DEFAULT_SHOP_POPUP_APPEARANCE: ShopPopupAppearance = {
  titleDesktopFontSize: 42,
  titleMobileFontSize: 30,
  descriptionDesktopFontSize: 15,
  descriptionMobileFontSize: 14,
  buttonDesktopFontSize: 16,
  buttonMobileFontSize: 14,
  badgeFontSize: 12,
  declineFontSize: 12,
  visualCaptionFontSize: 10,
  promoCodeFontSize: 20,
  panelBackgroundColor: "#F8F5F1",
  titleColor: "#1D1D1B",
  accentColor: "#E6610D",
  descriptionColor: "#655C55",
  badgeBackgroundColor: "#FAEAD5",
  badgeTextColor: "#C84E00",
  buttonBackgroundColor: "#5B328A",
  buttonTextColor: "#FFFFFF",
  declineTextColor: "#7D736B",
  visualTextColor: "#FFFFFF",
  visualBackgroundColor: "#5B328A",
  visualGlowColor: "#E6610D",
  promoPlateBackgroundColor: "#1D1D1B",
  promoPlateTextColor: "#FFFFFF",
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
  appearance: DEFAULT_SHOP_POPUP_APPEARANCE,
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback
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
    const values = settings as typeof settings & Record<string, unknown>
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
      appearance: {
        titleDesktopFontSize: number(values.titleDesktopFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.titleDesktopFontSize, 24, 72),
        titleMobileFontSize: number(values.titleMobileFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.titleMobileFontSize, 20, 52),
        descriptionDesktopFontSize: number(values.descriptionDesktopFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.descriptionDesktopFontSize, 10, 28),
        descriptionMobileFontSize: number(values.descriptionMobileFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.descriptionMobileFontSize, 10, 24),
        buttonDesktopFontSize: number(values.buttonDesktopFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.buttonDesktopFontSize, 10, 26),
        buttonMobileFontSize: number(values.buttonMobileFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.buttonMobileFontSize, 10, 24),
        badgeFontSize: number(values.badgeFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.badgeFontSize, 8, 20),
        declineFontSize: number(values.declineFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.declineFontSize, 9, 20),
        visualCaptionFontSize: number(values.visualCaptionFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.visualCaptionFontSize, 8, 18),
        promoCodeFontSize: number(values.promoCodeFontSize, DEFAULT_SHOP_POPUP_APPEARANCE.promoCodeFontSize, 12, 36),
        panelBackgroundColor: color(values.panelBackgroundColor, DEFAULT_SHOP_POPUP_APPEARANCE.panelBackgroundColor),
        titleColor: color(values.titleColor, DEFAULT_SHOP_POPUP_APPEARANCE.titleColor),
        accentColor: color(values.accentColor, DEFAULT_SHOP_POPUP_APPEARANCE.accentColor),
        descriptionColor: color(values.descriptionColor, DEFAULT_SHOP_POPUP_APPEARANCE.descriptionColor),
        badgeBackgroundColor: color(values.badgeBackgroundColor, DEFAULT_SHOP_POPUP_APPEARANCE.badgeBackgroundColor),
        badgeTextColor: color(values.badgeTextColor, DEFAULT_SHOP_POPUP_APPEARANCE.badgeTextColor),
        buttonBackgroundColor: color(values.buttonBackgroundColor, DEFAULT_SHOP_POPUP_APPEARANCE.buttonBackgroundColor),
        buttonTextColor: color(values.buttonTextColor, DEFAULT_SHOP_POPUP_APPEARANCE.buttonTextColor),
        declineTextColor: color(values.declineTextColor, DEFAULT_SHOP_POPUP_APPEARANCE.declineTextColor),
        visualTextColor: color(values.visualTextColor, DEFAULT_SHOP_POPUP_APPEARANCE.visualTextColor),
        visualBackgroundColor: color(values.visualBackgroundColor, DEFAULT_SHOP_POPUP_APPEARANCE.visualBackgroundColor),
        visualGlowColor: color(values.visualGlowColor, DEFAULT_SHOP_POPUP_APPEARANCE.visualGlowColor),
        promoPlateBackgroundColor: color(values.promoPlateBackgroundColor, DEFAULT_SHOP_POPUP_APPEARANCE.promoPlateBackgroundColor),
        promoPlateTextColor: color(values.promoPlateTextColor, DEFAULT_SHOP_POPUP_APPEARANCE.promoPlateTextColor),
      },
    }
  } catch (error) {
    console.error("[shop-popup] Настройки недоступны, используются безопасные значения по умолчанию", error)
    return DEFAULT_SHOP_POPUP
  }
}
