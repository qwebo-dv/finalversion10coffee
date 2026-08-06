"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, Minus, Plus, ShoppingBag, X } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { formatPrice } from "@/lib/utils/format"
import type { Product } from "@/types"

export function ShopHeader({ products }: { products: Product[] }) {
  const [cartOpen, setCartOpen] = useState(false)
  const { items, itemCount, updateQuantity, removeItem, clearCart } = useGuestCart()

  const cartLines = items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    return { item, product, variant }
  }).filter((line) => line.product && line.variant)
  const cartTotal = cartLines.reduce((sum, line) => sum + (line.variant?.price || 0) * line.item.quantity, 0)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f8f5f1]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1480px] items-center gap-6 px-5 lg:px-10">
          <Link href="/shop" className="text-2xl font-black tracking-[-0.08em] text-[#5b328a]">10COFFEE</Link>
          <span className="hidden rounded-full bg-[#faead5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b4d22] sm:inline">розничный магазин · preview</span>
          <button type="button" onClick={() => setCartOpen(true)} className="relative ml-auto flex h-11 items-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm font-bold text-white">
            <ShoppingBag className="h-4 w-4" /> Корзина
            {itemCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e6610d] px-1 text-[10px]">{itemCount}</span>}
          </button>
        </div>
      </header>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" onMouseDown={() => setCartOpen(false)}>
          <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center border-b border-black/[0.06] px-6 py-5"><div><h2 className="text-xl font-black">Корзина</h2><p className="text-xs text-[#8d827a]">{itemCount} товаров</p></div><button onClick={() => setCartOpen(false)} className="ml-auto rounded-full p-2 hover:bg-[#f5f1ed]"><X className="h-5 w-5" /></button></div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {cartLines.length === 0 ? <p className="py-20 text-center text-sm text-[#8d827a]">Корзина пока пуста</p> : cartLines.map(({ item, product, variant }) => (
                <div key={item.id} className="rounded-2xl bg-[#f8f5f1] p-4">
                  <div className="flex gap-3"><div className="min-w-0 flex-1"><p className="truncate font-bold">{product?.name}</p><p className="text-xs text-[#887d75]">{variant?.name}{item.grindOption ? ` · ${item.grindOption}` : ""}</p></div><button onClick={() => removeItem(item.id)}><X className="h-4 w-4 text-[#a0948c]" /></button></div>
                  <div className="mt-4 flex items-center justify-between"><div className="flex items-center rounded-full bg-white"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2"><Minus className="h-3 w-3" /></button><span className="w-7 text-center text-xs font-bold">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2"><Plus className="h-3 w-3" /></button></div><b>{formatPrice((variant?.price || 0) * item.quantity)}</b></div>
                </div>
              ))}
            </div>
            <div className="border-t border-black/[0.06] p-6"><div className="mb-4 flex items-end justify-between"><span className="text-sm text-[#766d66]">Итого</span><strong className="text-2xl">{formatPrice(cartTotal)}</strong></div><Link href="/checkout" className={`flex h-14 items-center justify-center gap-2 rounded-full text-sm font-black ${cartLines.length ? "bg-[#5b328a] text-white" : "pointer-events-none bg-[#eee9e5] text-[#aaa098]"}`}>Оформить заказ <ChevronRight className="h-4 w-4" /></Link>{cartLines.length > 0 && <button onClick={clearCart} className="mt-3 w-full text-xs font-bold text-[#9b9087] hover:text-red-600">Очистить корзину</button>}</div>
          </aside>
        </div>
      )}
    </>
  )
}
