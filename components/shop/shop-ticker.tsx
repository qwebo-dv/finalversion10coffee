"use client"

import type { CSSProperties } from "react"
import { useShopTickerSettings } from "./shop-ticker-provider"
import styles from "./shop-ticker.module.css"

const FONT_FAMILIES = {
  pixel: '"Press Start 2P", ui-monospace, monospace',
  site: 'var(--font-google-sans), Arial, sans-serif',
  monospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const

interface TickerItem {
  text: string
  highlighted: boolean
}

function TickerGroup({ items, marker, hidden = false }: { items: TickerItem[]; marker: string; hidden?: boolean }) {
  return (
    <div className={styles.group} aria-hidden={hidden || undefined}>
      {items.map((item, index) => (
        <span className={`${styles.item} ${item.highlighted ? styles.special : ""}`} key={`${item.text}-${index}`}>
          <span className={styles.marker} aria-hidden="true">{marker}</span>
          {item.text}
        </span>
      ))}
    </div>
  )
}

export function ShopTicker() {
  const settings = useShopTickerSettings()
  if (!settings.enabled || settings.items.length === 0) return null

  // Keep each half of the animated track long enough for large monitors even
  // when the editor leaves only one short message in Payload.
  const repetitions = Math.max(3, Math.ceil(24 / settings.items.length))
  const groupItems = Array.from({ length: repetitions }, () => settings.items).flat()
  const style = {
    "--ticker-background": settings.backgroundColor,
    "--ticker-text": settings.textColor,
    "--ticker-marker": settings.markerColor,
    "--ticker-highlight": settings.highlightColor,
    "--ticker-font": FONT_FAMILIES[settings.fontPreset],
    "--ticker-font-size": `${settings.desktopFontSize}px`,
    "--ticker-mobile-font-size": `${settings.mobileFontSize}px`,
    "--ticker-duration": `${settings.speedSeconds}s`,
  } as CSSProperties

  return (
    <section
      className={`${styles.ticker} ${settings.pauseOnHover ? styles.pauseOnHover : ""} ${settings.uppercase ? styles.uppercase : ""}`}
      style={style}
      aria-label="Преимущества интернет-магазина"
    >
      <div className={styles.track}>
        <TickerGroup items={groupItems} marker={settings.marker} />
        <TickerGroup items={groupItems} marker={settings.marker} hidden />
      </div>
    </section>
  )
}
