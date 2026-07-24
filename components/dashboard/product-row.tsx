"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Heart, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface ProductRowProps {
  product: Product
  isFavorite: boolean
}

export function ProductRow({ product, isFavorite: initialFav }: ProductRowProps) {
  const { addItem } = useCart()
  const [isFavorite, setIsFavorite] = useState(initialFav)
  const [isPending, startTransition] = useTransition()

  // Group variants by weight for display
  const variants250 = product.variants?.filter((v) =>
    v.name.includes("250")
  )
  const variants1kg = product.variants?.filter((v) =>
    v.name.includes("1 кг") || v.name.includes("1кг")
  )
  const otherVariants = product.variants?.filter(
    (v) =>
      !v.name.includes("250") &&
      !v.name.includes("1 кг") &&
      !v.name.includes("1кг")
  )

  function handleFavorite() {
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

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors">
      {/* Name + stickers */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={handleFavorite}
          className="shrink-0"
          disabled={isPending}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite
                ? "fill-red-500 text-red-500"
                : "text-muted-foreground hover:text-red-400"
            )}
          />
        </button>
        <Link
          href={`/dashboard/product/${product.id}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate"
        >
          {product.name}
        </Link>
        {product.stickers?.map((tag) => (
          <Badge
            key={tag.id}
            className={cn("text-[10px] px-1.5 py-0", getTagBgClass(tag.color))}
            style={getTagStyle(tag.color)}
          >
            {tag.name}
          </Badge>
        ))}
      </div>

      {/* 250g variant */}
      <div className="w-32">
        {variants250 && variants250.length > 0 ? (
          <VariantAddButton
            variant={variants250[0]}
            productId={product.id}
            onAdd={addItem}
          />
        ) : otherVariants && otherVariants.length > 0 ? (
          <VariantAddButton
            variant={otherVariants[0]}
            productId={product.id}
            onAdd={addItem}
          />
        ) : (
          <span className="text-xs text-muted-foreground text-center block">—</span>
        )}
      </div>

      {/* 1kg variant */}
      <div className="w-32">
        {variants1kg && variants1kg.length > 0 ? (
          <VariantAddButton
            variant={variants1kg[0]}
            productId={product.id}
            onAdd={addItem}
          />
        ) : (
          <span className="text-xs text-muted-foreground text-center block">—</span>
        )}
      </div>

      {/* Quick quantity controls */}
      <div className="w-20" />
    </div>
  )
}

function VariantAddButton({
  variant,
  productId,
  onAdd,
}: {
  variant: ProductVariant
  productId: string
  onAdd: (params: {
    productId: string
    variantId: string
    quantity: number
    grindOption?: string
  }) => Promise<void>
}) {
  const [quantity, setQuantity] = useState(1)
  const [grind, setGrind] = useState<string>(
    variant.grind_options?.[0] || ""
  )
  const hasGrind = variant.grind_options && variant.grind_options.length > 0

  async function handleAdd() {
    await onAdd({
      productId,
      variantId: variant.id,
      quantity,
      grindOption: grind || undefined,
    })
    setQuantity(1)
  }

  if (!variant.is_available) {
    return (
      <span className="text-xs text-muted-foreground text-center block">
        Нет в наличии
      </span>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-sm font-medium">{formatPrice(variant.price)}</span>
      <div className="flex items-center gap-1">
        {hasGrind && (
          <Select value={grind} onValueChange={setGrind}>
            <SelectTrigger className="h-7 w-20 text-[11px] px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variant.grind_options.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-0.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-xs w-6 text-center">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button size="icon" className="h-7 w-7" onClick={handleAdd}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
