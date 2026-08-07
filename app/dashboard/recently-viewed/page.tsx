"use client"

import { useEffect, useState } from "react"
import { Coffee, History, Loader2, ShoppingBag, Trash2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getRecentlyViewed, clearRecentlyViewed } from "@/lib/recently-viewed"
import { getProductsByIds } from "@/lib/actions/products"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { formatPrice, formatWeight } from "@/lib/utils/format"
import type { Product } from "@/types"

export default function RecentlyViewedPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const { addItem } = useGuestCart()

  useEffect(() => {
    const entries = getRecentlyViewed()
    if (entries.length === 0) {
      setLoading(false)
      return
    }
    getProductsByIds(entries.map((entry) => entry.productId)).then((items) => {
      setProducts(items)
      setLoading(false)
    })
  }, [])

  function handleAdd(product: Product) {
    const variant = product.variants?.[0]
    if (!variant) return
    addItem({ productId: product.id, variantId: variant.id, quantity: 1 })
    setAddedIds((prev) => new Set(prev).add(product.id))
    window.setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }, 1400)
  }

  function handleClear() {
    clearRecentlyViewed()
    setProducts([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Просмотренные товары</h1>
          <p className="text-muted-foreground">Товары, которые вы недавно смотрели в магазине</p>
        </div>
        {products.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Очистить
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#faead5]">
            <History className="h-7 w-7 text-[#e6610d]/40" />
          </div>
          <h3 className="mt-4 text-lg font-medium">Пока пусто</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Товары, которые вы открываете в магазине, появятся здесь
          </p>
          <Link href="/shop" className="mt-4 text-sm font-bold text-[#5b328a] hover:underline">
            Перейти в магазин
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const variant = product.variants?.[0]
            const added = addedIds.has(product.id)
            return (
              <div key={product.id} className="overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md">
                <Link href={`/shop/${product.slug}`} className="relative block aspect-[4/3] bg-[#faead5]">
                  {product.images[0] ? (
                    <Image src={product.images[0]} alt={product.name} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Coffee className="h-10 w-10 text-[#e6610d]/30" />
                    </div>
                  )}
                </Link>
                <div className="p-4">
                  <Link href={`/shop/${product.slug}`} className="line-clamp-2 text-sm font-bold text-neutral-900 hover:text-[#5b328a] transition-colors">
                    {product.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.region || product.product_type_name}
                    {variant?.weight_grams ? ` · ${formatWeight(variant.weight_grams)}` : ""}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <b className="text-sm">{variant ? formatPrice(variant.price) : "—"}</b>
                    <button
                      onClick={() => handleAdd(product)}
                      disabled={!variant || added}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-[#1d1d1b] px-4 text-xs font-bold text-white transition hover:bg-[#000] disabled:opacity-50"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {added ? "Добавлено" : "В корзину"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
