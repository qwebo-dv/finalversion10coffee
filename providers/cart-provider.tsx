"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"
import { useAuth } from "@/providers/auth-provider"
import {
  getCartItems as fetchCartItems,
  addToCart,
  updateCartQuantity as serverUpdateQuantity,
  removeCartItem as serverRemoveItem,
  clearCart as serverClearCart,
} from "@/lib/actions/cart"
import type { CartItem } from "@/types"
import { toast } from "sonner"

interface AppliedPromo {
  promoCodeId: string
  discountAmount: number
  discountType: "percentage" | "fixed_amount"
  discountValue: number
  applicableProductIds: string[]
  applicableProductNames: string[]
}

interface CartContextValue {
  items: CartItem[]
  loading: boolean
  addItem: (params: {
    productId: string
    variantId: string
    quantity: number
    grindOption?: string
  }) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  reloadCart: () => Promise<void>
  totalPrice: number
  totalWeight: number
  itemCount: number
  appliedPromo: AppliedPromo | null
  setAppliedPromo: (promo: AppliedPromo | null) => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)

  const loadCart = useCallback(async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }

    try {
      const cartItems = await fetchCartItems()
      setItems(cartItems)
    } catch {
      // silent fail
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCart()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCart])

  const addItem = useCallback(
    async (params: {
      productId: string
      variantId: string
      quantity: number
      grindOption?: string
    }) => {
      if (!user) return

      try {
        const result = await addToCart(params)
        if (result.success) {
          toast.success("Товар добавлен в корзину")
          await loadCart()
        } else {
          toast.error("Ошибка при добавлении в корзину")
        }
      } catch {
        toast.error("Ошибка при добавлении в корзину")
      }
    },
    [user, loadCart]
  )

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) return

      // Optimistic update
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
      )

      try {
        await serverUpdateQuantity(itemId, quantity)
      } catch {
        toast.error("Ошибка при обновлении количества")
        await loadCart()
      }
    },
    [loadCart]
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      // Optimistic update
      setItems((prev) => prev.filter((i) => i.id !== itemId))

      try {
        await serverRemoveItem(itemId)
      } catch {
        toast.error("Ошибка при удалении из корзины")
        await loadCart()
      }
    },
    [loadCart]
  )

  const clearCartFn = useCallback(async () => {
    if (!user) return

    setItems([])
    setAppliedPromo(null)

    try {
      await serverClearCart()
    } catch {
      toast.error("Ошибка при очистке корзины")
      await loadCart()
    }
  }, [user, loadCart])

  const totalPrice = items.reduce((sum, item) => {
    const price = item.variant?.price ?? 0
    return sum + price * item.quantity
  }, 0)

  const totalWeight = items.reduce((sum, item) => {
    const weight = item.variant?.weight_grams ?? 0
    return sum + weight * item.quantity
  }, 0)

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        loading,
        addItem,
        updateQuantity,
        removeItem,
        clearCart: clearCartFn,
        reloadCart: loadCart,
        totalPrice,
        totalWeight,
        itemCount,
        appliedPromo,
        setAppliedPromo,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
