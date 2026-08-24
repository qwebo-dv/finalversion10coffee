"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/providers/auth-provider"
import {
  addToCart as serverAddItem,
  clearCart as serverClearCart,
  getCartItems as fetchServerCart,
  removeCartItem as serverRemoveItem,
  updateCartQuantity as serverUpdateQuantity,
} from "@/lib/actions/cart"
import type { CartItem } from "@/types"

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
const STORAGE_OWNER_KEY = "10coffee-shop-cart-owner-v1"
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

function parsePendingPayment(value: string): PendingShopPayment | null {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object") return null

  const payment = parsed as Partial<PendingShopPayment>
  if (
    typeof payment.orderId !== "string" || !payment.orderId.trim()
    || typeof payment.orderNumber !== "string" || !payment.orderNumber.trim()
    || typeof payment.token !== "string" || !payment.token.trim()
    || typeof payment.paymentUrl !== "string" || !payment.paymentUrl.trim()
  ) {
    return null
  }

  return {
    orderId: payment.orderId,
    orderNumber: payment.orderNumber,
    token: payment.token,
    paymentUrl: payment.paymentUrl,
  }
}

function fromServerItem(item: CartItem): GuestCartItem {
  return {
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    quantity: item.quantity,
    ...(item.grind_option ? { grindOption: item.grind_option } : {}),
  }
}

export function GuestCartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState<GuestCartItem[]>([])
  const [storageHydrated, setStorageHydrated] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [pendingPayment, setPendingPaymentState] = useState<PendingShopPayment | null>(null)
  const loadRequest = useRef(0)
  const activeMutations = useRef(0)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      // Browser storage is the external source used to hydrate this client-only cart.
      if (stored) setItems(parseStoredItems(stored))
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    try {
      const pending = window.localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY)
      if (pending) {
        const parsedPending = parsePendingPayment(pending)
        if (parsedPending) setPendingPaymentState(parsedPending)
        else window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
      }
    } catch {
      window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
    }
    setStorageHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [hydrated, items])

  const reloadServerCart = useCallback(async () => {
    if (!user) return
    const requestId = ++loadRequest.current
    const serverItems = await fetchServerCart("individual")
    if (requestId !== loadRequest.current) return
    setItems(serverItems.map(fromServerItem))
    window.localStorage.setItem(STORAGE_OWNER_KEY, user.id)
  }, [user])

  useEffect(() => {
    if (!storageHydrated || authLoading) return
    let cancelled = false

    async function hydrateAuthoritativeCart() {
      if (!user) {
        const previousOwner = window.localStorage.getItem(STORAGE_OWNER_KEY)
        if (previousOwner) {
          window.localStorage.removeItem(STORAGE_OWNER_KEY)
          window.localStorage.removeItem(STORAGE_KEY)
          setItems([])
        }
        setHydrated(true)
        return
      }

      setHydrated(false)
      try {
        let serverItems = await fetchServerCart("individual")
        const storedOwner = window.localStorage.getItem(STORAGE_OWNER_KEY)
        const stored = window.localStorage.getItem(STORAGE_KEY)
        const localItems = stored ? parseStoredItems(stored) : []

        // A guest/legacy cart is migrated once. An existing server cart always
        // wins so another device cannot re-create items that were already deleted.
        if (serverItems.length === 0 && !storedOwner && localItems.length > 0) {
          await Promise.all(localItems.map((item) => serverAddItem({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            grindOption: item.grindOption,
          }, "individual")))
          serverItems = await fetchServerCart("individual")
        }

        if (cancelled) return
        setItems(serverItems.map(fromServerItem))
        window.localStorage.setItem(STORAGE_OWNER_KEY, user.id)
      } catch (error) {
        console.error("[shop-cart] Не удалось синхронизировать корзину", error)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    void hydrateAuthoritativeCart()
    return () => { cancelled = true }
  }, [authLoading, storageHydrated, user])

  useEffect(() => {
    if (!hydrated || !user) return

    function refreshFromServer() {
      if (document.visibilityState !== "visible" || activeMutations.current > 0) return
      void reloadServerCart().catch((error) => {
        console.error("[shop-cart] Не удалось обновить корзину", error)
      })
    }

    function refreshAfterStorageChange(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === STORAGE_OWNER_KEY) refreshFromServer()
    }

    const timer = window.setInterval(refreshFromServer, 15_000)
    window.addEventListener("focus", refreshFromServer)
    window.addEventListener("storage", refreshAfterStorageChange)
    document.addEventListener("visibilitychange", refreshFromServer)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refreshFromServer)
      window.removeEventListener("storage", refreshAfterStorageChange)
      document.removeEventListener("visibilitychange", refreshFromServer)
    }
  }, [hydrated, reloadServerCart, user])

  const setPendingPayment = useCallback((payment: PendingShopPayment | null) => {
    setPendingPaymentState(payment)
    if (payment) window.localStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(payment))
    else window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
  }, [])

  const addItem = useCallback((item: Omit<GuestCartItem, "id">) => {
    if (user) {
      activeMutations.current += 1
      void serverAddItem({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        grindOption: item.grindOption,
      }, "individual")
        .then((result) => {
          if (!result.success) throw new Error("Server cart rejected the item")
          return reloadServerCart()
        })
        .catch((error) => console.error("[shop-cart] Не удалось добавить товар", error))
        .finally(() => { activeMutations.current -= 1 })
      return
    }

    const id = buildItemId(item)
    setItems((current) => {
      const existing = current.find((entry) => entry.id === id)
      if (!existing) return [...current, { ...item, id }]
      return current.map((entry) => entry.id === id
        ? { ...entry, quantity: entry.quantity + item.quantity }
        : entry)
    })
  }, [reloadServerCart, user])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (user) {
      if (quantity <= 0) {
        activeMutations.current += 1
        setItems((current) => current.filter((item) => item.id !== id))
        void serverRemoveItem(id, "individual")
          .then((result) => {
            if (!result.success) throw new Error("Server cart did not remove the item")
            return reloadServerCart()
          })
          .catch((error) => {
            console.error("[shop-cart] Не удалось удалить товар", error)
            void reloadServerCart()
          })
          .finally(() => { activeMutations.current -= 1 })
        return
      }

      setItems((current) => current.map((item) => item.id === id ? { ...item, quantity } : item))
      activeMutations.current += 1
      void serverUpdateQuantity(id, quantity, "individual")
        .then((result) => {
          if (!result.success) throw new Error("Server cart did not update the item")
          return reloadServerCart()
        })
        .catch((error) => {
          console.error("[shop-cart] Не удалось обновить количество", error)
          void reloadServerCart()
        })
        .finally(() => { activeMutations.current -= 1 })
      return
    }

    if (quantity <= 0) {
      setItems((current) => current.filter((item) => item.id !== id))
      return
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity } : item))
  }, [reloadServerCart, user])

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
    if (!user) return
    activeMutations.current += 1
    void serverRemoveItem(id, "individual")
      .then((result) => {
        if (!result.success) throw new Error("Server cart did not remove the item")
        return reloadServerCart()
      })
      .catch((error) => {
        console.error("[shop-cart] Не удалось удалить товар", error)
        void reloadServerCart()
      })
      .finally(() => { activeMutations.current -= 1 })
  }, [reloadServerCart, user])

  const removeItems = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const idsToRemove = new Set(ids)
    setItems((current) => current.filter((item) => !idsToRemove.has(item.id)))
    if (!user) return
    activeMutations.current += 1
    void Promise.all(ids.map((id) => serverRemoveItem(id, "individual")))
      .then(() => reloadServerCart())
      .catch((error) => {
        console.error("[shop-cart] Не удалось удалить недоступные товары", error)
        void reloadServerCart()
      })
      .finally(() => { activeMutations.current -= 1 })
  }, [reloadServerCart, user])

  const clearCart = useCallback(() => {
    setItems([])
    if (!user) return
    activeMutations.current += 1
    void serverClearCart("individual")
      .then((result) => {
        if (!result.success) throw new Error("Server cart was not cleared")
        return reloadServerCart()
      })
      .catch((error) => {
        console.error("[shop-cart] Не удалось очистить корзину", error)
        void reloadServerCart()
      })
      .finally(() => { activeMutations.current -= 1 })
  }, [reloadServerCart, user])
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
