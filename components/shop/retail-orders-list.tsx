"use client"

import { OrdersList } from "@/components/dashboard/orders-list"
import { repeatOrder } from "@/lib/actions/orders"
import { useGuestCart } from "@/providers/guest-cart-provider"
import type { Order } from "@/types"

export function RetailOrdersList({ initialOrders }: { initialOrders: Order[] }) {
  const { reloadCart, setCartOpen } = useGuestCart()

  async function repeatRetailOrder(orderId: string) {
    const result = await repeatOrder(orderId, "individual")
    if (result.success) {
      // The header uses the retail cart, not the separate dashboard provider.
      await reloadCart()
      setCartOpen(true)
    }
    return result
  }

  return <OrdersList initialOrders={initialOrders} sessionScope="individual" onRepeatOrder={repeatRetailOrder} />
}
