"use client"

import { useEffect, useState, type CSSProperties } from "react"
import Image from "next/image"
import { useFormFields } from "@payloadcms/ui"
import { ArrowRight, Coffee, Copy, Sparkles, X } from "lucide-react"
import styles from "./ShopSettingsPreview.module.css"

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback
}

function richTextToPlainText(value: unknown): string {
  const chunks: string[] = []
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return
    const record = node as Record<string, unknown>
    if (typeof record.text === "string") chunks.push(record.text)
    if (Array.isArray(record.children)) {
      record.children.forEach(walk)
      if (record.type === "paragraph" || record.type === "listitem") chunks.push("\n")
    }
    if (record.root) walk(record.root)
  }
  walk(value)
  return chunks.join(" ").replace(/\s*\n\s*/g, "\n").replace(/[ \t]+/g, " ").trim()
}

function HighlightedTitle({ title }: { title: string }) {
  const match = title.match(/10\s*%\s+на\s+первый\s+заказ/i)
  if (!match || match.index === undefined) return title
  return <>{title.slice(0, match.index)}<em>{match[0]}</em>{title.slice(match.index + match[0].length)}</>
}

export default function ShopPopupPreview() {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [loadedImage, setLoadedImage] = useState<{ id: string; url: string } | null>(null)
  const settings = useFormFields(([fields]) => {
    const visualImage = fields?.visualImage?.value
    let directImageUrl: string | null = null
    let imageId: string | number | null = null
    if (visualImage && typeof visualImage === "object" && "url" in visualImage && typeof visualImage.url === "string") {
      directImageUrl = visualImage.url
    } else if (typeof visualImage === "string" || typeof visualImage === "number") {
      imageId = visualImage
    }

    return {
      enabled: fields?.enabled?.value !== false,
      badgeText: text(fields?.badgeText?.value, "Предложение для нового покупателя"),
      title: text(fields?.title?.value, "Дарим 10% на первый заказ и бонусы за каждый следующий").replace(/\s*☕\uFE0F?\s*$/u, ""),
      description: richTextToPlainText(fields?.description?.value) || "Зарегистрируйтесь в личном кабинете 10coffee, используйте промокод 10COFFEE, копите бонусы с покупок и оплачивайте ими новые заказы.",
      promoCode: text(fields?.promoCode?.value, "10COFFEE").toUpperCase(),
      ctaLabel: text(fields?.ctaLabel?.value, "Получить скидку 10% и зарегистрироваться"),
      declineLabel: text(fields?.declineLabel?.value, "Нет, спасибо, я предпочитаю платить полную цену"),
      visualMode: fields?.visualMode?.value === "image" ? "image" : "coffee",
      visualCaption: text(fields?.visualCaption?.value, "Свежая обжарка · бонусы с каждой покупки"),
      titleDesktopFontSize: number(fields?.titleDesktopFontSize?.value, 42, 24, 72),
      titleMobileFontSize: number(fields?.titleMobileFontSize?.value, 30, 20, 52),
      descriptionDesktopFontSize: number(fields?.descriptionDesktopFontSize?.value, 15, 10, 28),
      descriptionMobileFontSize: number(fields?.descriptionMobileFontSize?.value, 14, 10, 24),
      buttonDesktopFontSize: number(fields?.buttonDesktopFontSize?.value, 16, 10, 26),
      buttonMobileFontSize: number(fields?.buttonMobileFontSize?.value, 14, 10, 24),
      badgeFontSize: number(fields?.badgeFontSize?.value, 12, 8, 20),
      declineFontSize: number(fields?.declineFontSize?.value, 12, 9, 20),
      visualCaptionFontSize: number(fields?.visualCaptionFontSize?.value, 10, 8, 18),
      promoCodeFontSize: number(fields?.promoCodeFontSize?.value, 20, 12, 36),
      panelBackgroundColor: color(fields?.panelBackgroundColor?.value, "#F8F5F1"),
      titleColor: color(fields?.titleColor?.value, "#1D1D1B"),
      accentColor: color(fields?.accentColor?.value, "#E6610D"),
      descriptionColor: color(fields?.descriptionColor?.value, "#655C55"),
      badgeBackgroundColor: color(fields?.badgeBackgroundColor?.value, "#FAEAD5"),
      badgeTextColor: color(fields?.badgeTextColor?.value, "#C84E00"),
      buttonBackgroundColor: color(fields?.buttonBackgroundColor?.value, "#5B328A"),
      buttonTextColor: color(fields?.buttonTextColor?.value, "#FFFFFF"),
      declineTextColor: color(fields?.declineTextColor?.value, "#7D736B"),
      visualTextColor: color(fields?.visualTextColor?.value, "#FFFFFF"),
      visualBackgroundColor: color(fields?.visualBackgroundColor?.value, "#5B328A"),
      visualGlowColor: color(fields?.visualGlowColor?.value, "#E6610D"),
      promoPlateBackgroundColor: color(fields?.promoPlateBackgroundColor?.value, "#1D1D1B"),
      promoPlateTextColor: color(fields?.promoPlateTextColor?.value, "#FFFFFF"),
      directImageUrl,
      imageId,
    }
  })

  useEffect(() => {
    if (settings.directImageUrl || !settings.imageId) return
    const requestedId = String(settings.imageId)
    const controller = new AbortController()
    fetch(`/api/media/${settings.imageId}?depth=0`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((media) => {
        if (typeof media?.url === "string") setLoadedImage({ id: requestedId, url: media.url })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [settings.directImageUrl, settings.imageId])

  const imageUrl = settings.directImageUrl
    || (settings.imageId && loadedImage?.id === String(settings.imageId) ? loadedImage.url : null)
  const previewStyle = {
    "--preview-popup-title-size": `${device === "mobile" ? settings.titleMobileFontSize : settings.titleDesktopFontSize}px`,
    "--preview-popup-description-size": `${device === "mobile" ? settings.descriptionMobileFontSize : settings.descriptionDesktopFontSize}px`,
    "--preview-popup-button-size": `${device === "mobile" ? settings.buttonMobileFontSize : settings.buttonDesktopFontSize}px`,
    "--preview-popup-badge-size": `${settings.badgeFontSize}px`,
    "--preview-popup-decline-size": `${settings.declineFontSize}px`,
    "--preview-popup-caption-size": `${settings.visualCaptionFontSize}px`,
    "--preview-popup-code-size": `${settings.promoCodeFontSize}px`,
    "--preview-popup-panel-bg": settings.panelBackgroundColor,
    "--preview-popup-title": settings.titleColor,
    "--preview-popup-accent": settings.accentColor,
    "--preview-popup-description": settings.descriptionColor,
    "--preview-popup-badge-bg": settings.badgeBackgroundColor,
    "--preview-popup-badge-text": settings.badgeTextColor,
    "--preview-popup-button-bg": settings.buttonBackgroundColor,
    "--preview-popup-button-text": settings.buttonTextColor,
    "--preview-popup-decline": settings.declineTextColor,
    "--preview-popup-visual-text": settings.visualTextColor,
    "--preview-popup-visual-bg": settings.visualBackgroundColor,
    "--preview-popup-glow": settings.visualGlowColor,
    "--preview-popup-plate-bg": settings.promoPlateBackgroundColor,
    "--preview-popup-plate-text": settings.promoPlateTextColor,
  } as CSSProperties

  return (
    <section className={styles.previewPanel}>
      <div className={styles.previewHeader}>
        <div>
          <strong>Предпросмотр промо-баннера</strong>
          <span>Изменения отображаются до сохранения</span>
        </div>
        <div className={styles.deviceSwitch} aria-label="Размер предпросмотра">
          <button type="button" className={device === "desktop" ? styles.activeDevice : ""} onClick={() => setDevice("desktop")}>Десктоп</button>
          <button type="button" className={device === "mobile" ? styles.activeDevice : ""} onClick={() => setDevice("mobile")}>Мобильный</button>
        </div>
      </div>

      <div className={`${styles.popupStage} ${device === "mobile" ? styles.popupStageMobile : ""}`}>
        {settings.enabled ? (
          <article className={`${styles.popupCard} ${device === "mobile" ? styles.popupCardMobile : ""}`} style={previewStyle}>
            <button type="button" className={styles.mockClose} aria-label="Кнопка закрытия в предпросмотре"><X /></button>
            <div className={styles.popupCopy}>
              <span className={styles.popupBadge}><Sparkles /> {settings.badgeText}</span>
              <h3><HighlightedTitle title={settings.title} /></h3>
              <p>{settings.description}</p>
              <button type="button" className={styles.mockCta}><span>{settings.ctaLabel}</span><ArrowRight /></button>
              <u>{settings.declineLabel}</u>
            </div>
            <div className={styles.popupVisual}>
              <div className={styles.visualHeader}>
                <Image className={styles.previewLogoImage} src="/logo.svg" alt="10coffee" width={138} height={52} />
                <small>{settings.visualCaption}</small>
              </div>
              <div className={styles.coffeePackArtwork}>
                {settings.visualMode === "image" && imageUrl ? (
                  <div
                    role="img"
                    aria-label="Изображение упаковки кофе"
                    className={`${styles.coffeePackImage} ${styles.customCoffeePackImage}`}
                    style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}
                  />
                ) : (
                    <Image
                      className={styles.coffeePackImage}
                      src="/landing/assortment/webp/honduras.webp"
                      alt="Пачка кофе 10coffee"
                      fill
                      sizes="(max-width: 700px) 260px, 360px"
                    />
                )}
                <div className={styles.discountBadge}><span>10%</span><b>НА ПЕРВЫЙ</b></div>
              </div>
              <div className={styles.bonusPill}><Coffee /> <span>1 бонус = 1 ₽</span></div>
              <div className={styles.promoPlate}>
                <div><small>ВАШ ПРОМОКОД</small><strong>{settings.promoCode}<Copy /></strong></div>
                <span className={styles.promoSparkle}><Sparkles /></span>
              </div>
            </div>
          </article>
        ) : <div className={styles.disabledPreview}>Промо-баннер отключён</div>}
      </div>
    </section>
  )
}
