"use client"

import { useState, type CSSProperties } from "react"
import { useFormFields } from "@payloadcms/ui"
import styles from "./ShopSettingsPreview.module.css"

const DEFAULT_ITEMS = [
  { text: "Промокод 10COFFEE", highlighted: true },
  { text: "Скидка 10% на первый заказ", highlighted: true },
  { text: "Свежая обжарка в Сочи", highlighted: false },
  { text: "Доставка по всей России", highlighted: false },
]

const FONT_FAMILIES = {
  pixel: '"Press Start 2P", ui-monospace, monospace',
  site: 'Arial, sans-serif',
  monospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default function ShopTickerPreview() {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const settings = useFormFields(([fields]) => {
    const items = Object.keys(fields || {})
      .filter((key) => /^items\.\d+\.text$/.test(key))
      .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))
      .map((key) => ({
        text: text(fields[key]?.value, ""),
        highlighted: fields[key.replace(/\.text$/, ".highlighted")]?.value === true,
      }))
      .filter((item) => item.text)

    const preset = fields?.fontPreset?.value
    return {
      enabled: fields?.enabled?.value !== false,
      items: items.length ? items : DEFAULT_ITEMS,
      backgroundColor: text(fields?.backgroundColor?.value, "#CBCAC6"),
      textColor: text(fields?.textColor?.value, "#FFFFFF"),
      markerColor: text(fields?.markerColor?.value, "#FFFFFF"),
      highlightColor: text(fields?.highlightColor?.value, "#FFFFFF"),
      fontFamily: FONT_FAMILIES[preset === "site" || preset === "monospace" ? preset : "pixel"],
      desktopFontSize: number(fields?.desktopFontSize?.value, 9),
      mobileFontSize: number(fields?.mobileFontSize?.value, 8),
      marker: text(fields?.marker?.value, "✦"),
      uppercase: fields?.uppercase?.value !== false,
    }
  })

  const tickerStyle = {
    "--preview-ticker-bg": settings.backgroundColor,
    "--preview-ticker-text": settings.textColor,
    "--preview-ticker-marker": settings.markerColor,
    "--preview-ticker-highlight": settings.highlightColor,
    "--preview-ticker-font": settings.fontFamily,
    "--preview-ticker-size": `${device === "mobile" ? settings.mobileFontSize : settings.desktopFontSize}px`,
  } as CSSProperties
  const repeatedItems = [...settings.items, ...settings.items, ...settings.items]

  return (
    <section className={styles.previewPanel}>
      <div className={styles.previewHeader}>
        <div>
          <strong>Предпросмотр бегущей строки</strong>
          <span>Изменения отображаются до сохранения</span>
        </div>
        <div className={styles.deviceSwitch} aria-label="Размер предпросмотра">
          <button type="button" className={device === "desktop" ? styles.activeDevice : ""} onClick={() => setDevice("desktop")}>Десктоп</button>
          <button type="button" className={device === "mobile" ? styles.activeDevice : ""} onClick={() => setDevice("mobile")}>Мобильный</button>
        </div>
      </div>

      <div className={`${styles.deviceFrame} ${device === "mobile" ? styles.mobileFrame : styles.desktopFrame}`}>
        <div className={styles.mockHeader}><span>10 КОФЕ</span><span>Купить · Новости · Покупателю</span><span>Корзина</span></div>
        {settings.enabled ? (
          <div className={styles.tickerPreview} style={tickerStyle}>
            <div className={`${styles.tickerPreviewTrack} ${settings.uppercase ? styles.previewUppercase : ""}`}>
              {repeatedItems.map((item, index) => (
                <span key={`${item.text}-${index}`} className={item.highlighted ? styles.tickerHighlighted : ""}>
                  {item.text}<i>{settings.marker}</i>
                </span>
              ))}
            </div>
          </div>
        ) : <div className={styles.disabledPreview}>Бегущая строка отключена</div>}
      </div>
    </section>
  )
}
