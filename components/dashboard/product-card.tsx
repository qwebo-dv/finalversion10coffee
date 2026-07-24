"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { Heart, Plus, Minus, ShoppingCart, Coffee, Check, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCart } from "@/providers/cart-provider"
import { toggleFavorite } from "@/lib/actions/products"
import { formatPrice } from "@/lib/utils/format"
import { getTagBgClass, getTagStyle } from "@/lib/utils/constants"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Product, ProductVariant } from "@/types"

interface ProductCardProps {
  product: Product
  isFavorite: boolean
  index?: number
}

export function ProductCard({ product, isFavorite: initialFav, index = 0 }: ProductCardProps) {
  const { items, addItem, updateQuantity, removeItem } = useCart()
  const variants = (product.variants || []).filter((variant) => variant.is_available !== false)
  const [isFavorite, setIsFavorite] = useState(initialFav)
  const [isPending, startTransition] = useTransition()
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    variants[0] || null
  )
  const [quantity, setQuantity] = useState(1)
  const [grind, setGrind] = useState<string>(
    selectedVariant?.grind_options?.[0] || ""
  )
  const [addedToCart, setAddedToCart] = useState(false)

  // Find matching cart item for current variant+grind
  const cartItem = items.find(
    (i) =>
      i.product_id === product.id &&
      i.variant_id === selectedVariant?.id &&
      (i.grind_option || "") === (grind || "")
  )
  const inCart = !!cartItem

  function handleFavorite(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsFavorite(!isFavorite)
    startTransition(async () => {
      const result = await toggleFavorite(product.id)
      if ("isFavorite" in result) {
        setIsFavorite(result.isFavorite ?? false)
        if (result.isFavorite) {
          toast.success("Добавлено в избранное")
        } else {
          toast("Удалено из избранного")
        }
      }
    })
  }

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedVariant) return

    await addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity,
      grindOption: grind || undefined,
    })
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 1500)
    setQuantity(1)
  }


  return (
    <div
      className="group relative flex flex-col h-full text-left rounded-[20px] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 animate-fade-in-up bg-white border border-black/[0.04] hover:shadow-2xl hover:shadow-[#5b328a]/10"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
    >
      {/* Image area - large and prominent */}
      <Link href={`/dashboard/product/${product.id}`} className="relative block">
        <div className="relative aspect-[4/3] bg-gradient-to-br bg-[#faead5] overflow-hidden">
          {product.images && product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-all duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Coffee className="h-16 w-16 text-[#e6610d]/30 transition-all duration-500 group-hover:text-[#e6610d]/50 group-hover:scale-110" />
            </div>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
        </div>

        {/* Stickers - floating badges */}
        {product.stickers && product.stickers.length > 0 && (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {product.stickers.map((tag) => (
              <Badge
                key={tag.id}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg border-0",
                  getTagBgClass(tag.color)
                )}
                style={getTagStyle(tag.color)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Favorite button - glass effect */}
        <button
          onClick={handleFavorite}
          disabled={isPending}
          className={cn(
            "absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",
            isFavorite
              ? "bg-red-500 shadow-lg shadow-red-500/30 scale-100"
              : "bg-white/80 backdrop-blur-md shadow-lg hover:bg-white hover:scale-110"
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all duration-300",
              isFavorite
                ? "fill-white text-white"
                : "text-neutral-500 group-hover:text-red-400"
            )}
          />
        </button>

        {/* Q-grader badge floating */}
        {product.q_grader_rating && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full">
            <Star className="h-3 w-3 text-[#e6610d] fill-[#e6610d]" />
            <span className="text-[11px] font-bold text-white">Q{product.q_grader_rating}</span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 pt-3">
        <Link href={`/dashboard/product/${product.id}`}>
          <h3 className="text-[14px] font-bold text-neutral-900 group-hover:text-[#5b328a] transition-colors line-clamp-2 leading-snug">
            {product.name}
          </h3>
        </Link>

        {/* Coffee details - elegant */}
        {product.product_type_schema === "coffee" && product.region && (
          <p className="text-[11px] text-neutral-400 mt-1 truncate font-medium">
            {product.region}
            {product.roast_level && (
              <span className="text-[#e6610d]/40"> &middot; </span>
            )}
            {product.roast_level && (
              <span className="text-neutral-500">{product.roast_level}</span>
            )}
          </p>
        )}

        <div className="flex-1" />

        {/* Variants selector */}
        {variants.length > 0 && (
          <div className="mt-3 space-y-2.5">
            {/* Variant pills - sleek */}
            <div className="flex flex-wrap gap-1.5">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={(e) => {
                    e.preventDefault()
                    setSelectedVariant(v)
                    setGrind(v.grind_options?.[0] || "")
                  }}
                  className={cn(
                    "text-[11px] px-3 py-1.5 rounded-full font-semibold transition-all duration-200",
                    selectedVariant?.id === v.id
                      ? "bg-[#5b328a] text-white shadow-md shadow-[#5b328a]/20"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>

            {/* Grind selector - minimal */}
            {selectedVariant?.grind_options && selectedVariant.grind_options.length > 0 && (
              <Select value={grind} onValueChange={setGrind}>
                <SelectTrigger className="h-8 text-[11px] rounded-xl border-neutral-200/80 bg-neutral-50 font-medium">
                  <SelectValue placeholder="Помол" />
                </SelectTrigger>
                <SelectContent>
                  {selectedVariant.grind_options.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-xs">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Price + add to cart - clean layout */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xl font-black text-neutral-900 tracking-tight">
                {selectedVariant ? formatPrice(selectedVariant.price) : "—"}
              </span>

              <div className="flex items-center gap-1.5">
                {inCart ? (
                  /* Cart quantity controls — item already in cart */
                  <div className="flex items-center bg-[#5b328a]/10 rounded-full">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (cartItem.quantity <= 1) {
                          removeItem(cartItem.id)
                        } else {
                          updateQuantity(cartItem.id, cartItem.quantity - 1)
                        }
                      }}
                      className="h-8 w-8 flex items-center justify-center text-[#5b328a] hover:text-[#4a2870] transition-colors rounded-full hover:bg-[#5b328a]/20"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-[12px] font-bold text-[#5b328a]">
                      {cartItem.quantity}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        updateQuantity(cartItem.id, cartItem.quantity + 1)
                      }}
                      className="h-8 w-8 flex items-center justify-center text-[#5b328a] hover:text-[#4a2870] transition-colors rounded-full hover:bg-[#5b328a]/20"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  /* Not in cart — local quantity + add button */
                  <>
                    <div className="flex items-center bg-neutral-100 rounded-full">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setQuantity(Math.max(1, quantity - 1))
                        }}
                        className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors rounded-full hover:bg-neutral-200"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-[12px] font-bold text-neutral-900">
                        {quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setQuantity(quantity + 1)
                        }}
                        className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-colors rounded-full hover:bg-neutral-200"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={!selectedVariant}
                      className={cn(
                        "h-9 w-9 flex items-center justify-center rounded-full transition-colors duration-300",
                        addedToCart
                          ? "bg-[#5b328a] text-white"
                          : "bg-[#5b328a] text-white hover:bg-[#4a2870] active:scale-95"
                      )}
                    >
                      {addedToCart ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <ShoppingCart className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
