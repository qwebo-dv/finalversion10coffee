import type { CSSProperties } from "react"

const HEX_COLOR = /^#([0-9a-f]{6})$/i

export function getTagColorStyle(color?: string): CSSProperties {
  const match = color?.trim().match(HEX_COLOR)
  if (!match) return { backgroundColor: "#ffffff", color: "#2d1b11", borderColor: "rgba(45,27,17,0.1)" }

  const hex = match[1]
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000

  return {
    backgroundColor: `#${hex}`,
    borderColor: `#${hex}`,
    color: luminance > 165 ? "#1d1d1b" : "#ffffff",
  }
}
