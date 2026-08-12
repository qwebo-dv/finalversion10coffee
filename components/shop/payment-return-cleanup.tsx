"use client"

import { useEffect } from "react"
import { useGuestCart } from "@/providers/guest-cart-provider"

export function PaymentReturnCleanup({ paid }: { paid: boolean }) {
  const { clearCart, setPendingPayment } = useGuestCart()

  useEffect(() => {
    if (!paid) return
    clearCart()
    setPendingPayment(null)
  }, [clearCart, paid, setPendingPayment])

  return null
}
