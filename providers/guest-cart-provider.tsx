"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export interface GuestCartItem {
  id: string
  productId: string
  variantId: string
  quantity: number
  grindOption?: string
}

interface GuestCartContextValue {
  items: GuestCartItem[]
  itemCount: number
  hydrated: boolean
  addItem: (item: Omit<GuestCartItem, "id">) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const STORAGE_KEY = "10coffee-shop-cart-v1"
const GuestCartContext = createContext<GuestCartContextValue | null>(null)

function buildItemId(item: Pick<GuestCartItem, "productId" | "variantId" | "grindOption">) {
  return `${item.productId}:${item.variantId}:${item.grindOption || ""}`
}

export function GuestCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<GuestCartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setItems(JSON.parse(stored) as GuestCartItem[])
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [hydrated, items])

  const addItem = useCallback((item: Omit<GuestCartItem, "id">) => {
    const id = buildItemId(item)
    setItems((current) => {
      const existing = current.find((entry) => entry.id === id)
      if (!existing) return [...current, { ...item, id }]
      return current.map((entry) => entry.id === id
        ? { ...entry, quantity: entry.quantity + item.quantity }
        : entry)
    })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((current) => current.filter((item) => item.id !== id))
      return
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity } : item))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  return (
    <GuestCartContext.Provider value={{ items, itemCount, hydrated, addItem, updateQuantity, removeItem, clearCart }}>
      {children}
    </GuestCartContext.Provider>
  )
}

export function useGuestCart() {
  const value = useContext(GuestCartContext)
  if (!value) throw new Error("useGuestCart must be used within GuestCartProvider")
  return value
}
