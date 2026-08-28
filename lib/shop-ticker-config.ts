export type ShopTickerFontPreset = "pixel" | "site" | "monospace"

export interface ShopTickerItem {
  text: string
  highlighted: boolean
}

export interface ShopTickerContent {
  enabled: boolean
  items: ShopTickerItem[]
  backgroundColor: string
  textColor: string
  markerColor: string
  highlightColor: string
  fontPreset: ShopTickerFontPreset
  desktopFontSize: number
  mobileFontSize: number
  speedSeconds: number
  marker: string
  uppercase: boolean
  pauseOnHover: boolean
}

export const DEFAULT_SHOP_TICKER: ShopTickerContent = {
  enabled: true,
  items: [
    { text: "Промокод 10COFFEE", highlighted: true },
    { text: "Скидка 10% на первый заказ", highlighted: true },
    { text: "Свежая обжарка в Сочи", highlighted: false },
    { text: "Доставка по всей России", highlighted: false },
    { text: "Бонусы за покупки", highlighted: false },
    { text: "Кофе, чай и аксессуары", highlighted: false },
    { text: "Самовывоз в Сочи", highlighted: false },
    { text: "Помол под ваш способ заваривания", highlighted: false },
  ],
  backgroundColor: "#CBCAC6",
  textColor: "#FFFFFF",
  markerColor: "#FFFFFF",
  highlightColor: "#FFFFFF",
  fontPreset: "pixel",
  desktopFontSize: 9,
  mobileFontSize: 8,
  speedSeconds: 92,
  marker: "✦",
  uppercase: true,
  pauseOnHover: true,
}
