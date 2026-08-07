"use client"

import { useState, useEffect, useTransition } from "react"
import { Heart, Coffee, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/providers/auth-provider"
import { toggleFavorite, getFavoriteProducts } from "@/lib/actions/products"
import type { Product } from "@/types"

export default function FavoritesPage() {
  const { user } = useAuth()
  const isIndividual = user?.user_metadata?.customer_type === "individual"
  const [favorites, setFavorites] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    getFavoriteProducts().then((prods) => {
      setFavorites(prods)
      setLoading(false)
    })
  }, [])

  function handleRemove(productId: string) {
    setRemovingId(productId)
    startTransition(async () => {
      await toggleFavorite(productId)
      setFavorites((prev) => prev.filter((p) => p.id !== productId))
      setRemovingId(null)
    })
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Избранное</h1>
        <p className="text-muted-foreground">Сохранённые товары</p>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Heart className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">Нет избранных товаров</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Нажмите на сердечко рядом с товаром, чтобы добавить его в избранное
          </p>
          <Button className="mt-4" asChild>
            <Link href={isIndividual ? "/shop" : "/dashboard/catalog"}>Перейти в каталог</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className="relative h-12 w-12 rounded-lg bg-[#faead5] flex items-center justify-center shrink-0 overflow-hidden">
                {product.images && product.images.length > 0 ? (
                  <Image src={product.images[0]} alt={product.name} fill sizes="48px" className="object-cover" />
                ) : (
                  <Coffee className="h-5 w-5 text-[#5b328a]/30" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <Link
                  href={isIndividual ? `/shop/${product.slug}` : `/dashboard/product/${product.id}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {product.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {product.region || product.product_type_name || product.product_type}
                </p>
              </div>

              <button
                onClick={() => handleRemove(product.id)}
                disabled={removingId === product.id}
                className="shrink-0 p-2 rounded-full hover:bg-red-50 transition-colors group"
              >
                {removingId === product.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Heart className="h-4 w-4 fill-red-500 text-red-500 group-hover:fill-red-400 group-hover:text-red-400 transition-colors" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
