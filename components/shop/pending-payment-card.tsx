"use client"

import { useCallback, useEffect, useState } from "react"
import { CreditCard, Loader2 } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    throw new Error(`Сервер не вернул ответ (HTTP ${response.status})`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Сервер вернул некорректный ответ (HTTP ${response.status})`)
  }
}

export function PendingPaymentCard() {
  const { pendingPayment, setPendingPayment, clearCart } = useGuestCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkPaymentStatus = useCallback(async () => {
    if (!pendingPayment) return
    const response = await fetch("/api/shop/payments/yookassa/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: pendingPayment.token }),
    })
    const result = await readResponse<{ ok?: boolean; status?: string }>(response)
    if (response.ok && result.ok && result.status === "paid") {
      clearCart()
      setPendingPayment(null)
      window.location.assign(`/order/success?orderId=${encodeURIComponent(pendingPayment.orderId)}`)
    } else if (response.ok && result.ok && ["cancelled", "failed", "refunded"].includes(result.status || "")) {
      setPendingPayment(null)
      window.alert("Платёж отменён. Товары остались в корзине, можно оформить новый заказ.")
    }
  }, [clearCart, pendingPayment, setPendingPayment])

  useEffect(() => {
    if (!pendingPayment) return
    void checkPaymentStatus().catch(() => undefined)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkPaymentStatus().catch(() => undefined)
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [checkPaymentStatus, pendingPayment])

  if (!pendingPayment) return null

  async function retry() {
    const payment = pendingPayment
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/shop/payments/yookassa/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: payment.token }),
      })
      const result = await readResponse<{ ok?: boolean; status?: string; paymentUrl?: string; error?: string }>(response)
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось повторить оплату")
      if (result.status === "paid") {
        clearCart()
        setPendingPayment(null)
        window.location.assign(`/order/success?orderId=${encodeURIComponent(payment.orderId)}`)
        return
      }
      if (result.paymentUrl) {
        setPendingPayment({ ...payment, paymentUrl: result.paymentUrl })
        window.location.assign(result.paymentUrl)
        return
      }
      throw new Error("Платёжная ссылка не получена")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось повторить оплату")
      setLoading(false)
    }
  }

  async function abandonPayment() {
    if (!window.confirm(`Не оплачивать заказ ${pendingPayment?.orderNumber}? Товары останутся в корзине, и вы сможете оформить новый заказ.`)) return
    const payment = pendingPayment
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/shop/payments/yookassa/abandon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: payment.token }),
      })
      const result = await readResponse<{ ok?: boolean; error?: string }>(response)
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось отменить заказ")
      setPendingPayment(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось отменить заказ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-5 rounded-2xl border border-[#5b328a]/15 bg-[#f8f4fb] p-4">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#5b328a]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Заказ {pendingPayment.orderNumber} ожидает оплаты</p>
          <p className="mt-1 text-xs leading-5 text-[#756b63]">Товары сохранены. Можно вернуться к оплате без повторного оформления заказа.</p>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          <button type="button" onClick={retry} disabled={loading} className="mt-3 flex h-10 items-center gap-2 rounded-full bg-[#5b328a] px-4 text-xs font-black text-white disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {loading ? "Проверяем…" : "Повторить оплату"}
          </button>
          <button type="button" onClick={() => void abandonPayment()} disabled={loading} className="mt-2 block text-xs font-bold text-[#756b63] underline decoration-[#756b63]/30 underline-offset-4 hover:text-red-600">
            Не оплачивать этот заказ
          </button>
        </div>
      </div>
    </div>
  )
}
