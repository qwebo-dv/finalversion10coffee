"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export interface GuestCartItem {
  id: string
  productId: string
  variantId: string
  quantity: number
  grindOption?: string
}

export interface PendingShopPayment {
  orderId: string
  orderNumber: string
  token: string
  paymentUrl: string
}

interface GuestCartContextValue {
  items: GuestCartItem[]
  itemCount: number
  hydrated: boolean
  addItem: (item: Omit<GuestCartItem, "id">) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  removeItems: (ids: string[]) => void
  clearCart: () => void
  pendingPayment: PendingShopPayment | null
  setPendingPayment: (payment: PendingShopPayment | null) => void
}

const STORAGE_KEY = "10coffee-shop-cart-v1"
const PENDING_PAYMENT_STORAGE_KEY = "10coffee-shop-pending-payment-v1"
const GuestCartContext = createContext<GuestCartContextValue | null>(null)

function buildItemId(item: Pick<GuestCartItem, "productId" | "variantId" | "grindOption">) {
  return `${item.productId}:${item.variantId}:${item.grindOption || ""}`
}

function parseStoredItems(value: string): GuestCartItem[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed)) return []

  const items = new Map<string, GuestCartItem>()
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object") continue
    const item = candidate as Partial<GuestCartItem>
    if (typeof item.productId !== "string" || !item.productId) continue
    if (typeof item.variantId !== "string" || !item.variantId) continue
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) continue
    if (item.grindOption != null && typeof item.grindOption !== "string") continue

    const normalized = {
      productId: item.productId,
      variantId: item.variantId,
      quantity: Math.floor(item.quantity),
      ...(item.grindOption ? { grindOption: item.grindOption } : {}),
    }
    const id = buildItemId(normalized)
    items.set(id, { ...normalized, id })
  }

  return Array.from(items.values())
}

export function GuestCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<GuestCartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [pendingPayment, setPendingPaymentState] = useState<PendingShopPayment | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      // Browser storage is the external source used to hydrate this client-only cart.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setItems(parseStoredItems(stored))
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    try {
      const pending = window.localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY)
      if (pending) setPendingPaymentState(JSON.parse(pending) as PendingShopPayment)
    } catch {
      window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [hydrated, items])

  const setPendingPayment = useCallback((payment: PendingShopPayment | null) => {
    setPendingPaymentState(payment)
    if (payment) window.localStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(payment))
    else window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
  }, [])

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

  const removeItems = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idsToRemove = new Set(ids)
    setItems((current) => current.filter((item) => !idsToRemove.has(item.id)))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  return (
    <GuestCartContext.Provider value={{ items, itemCount, hydrated, addItem, updateQuantity, removeItem, removeItems, clearCart, pendingPayment, setPendingPayment }}>
      {children}
    </GuestCartContext.Provider>
  )
}

export function useGuestCart() {
  const value = useContext(GuestCartContext)
  if (!value) throw new Error("useGuestCart must be used within GuestCartProvider")
  return value
}
