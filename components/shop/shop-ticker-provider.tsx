"use client"

import { createContext, useContext } from "react"
import { DEFAULT_SHOP_TICKER, type ShopTickerContent } from "@/lib/shop-ticker-config"

const ShopTickerContext = createContext<ShopTickerContent>(DEFAULT_SHOP_TICKER)

export function ShopTickerProvider({ settings, children }: { settings: ShopTickerContent; children: React.ReactNode }) {
  return <ShopTickerContext.Provider value={settings}>{children}</ShopTickerContext.Provider>
}

export function useShopTickerSettings(): ShopTickerContent {
  return useContext(ShopTickerContext)
}
