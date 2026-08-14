"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { openAuthModal } from "@/components/auth/auth-modal-store"
import { toggleFavorite } from "@/lib/actions/products"
import { useAuth } from "@/providers/auth-provider"

interface ShopFavoriteButtonProps {
  productId: string
  initialIsFavorite: boolean
  variant?: "card" | "detail"
}

export function ShopFavoriteButton({
  productId,
  initialIsFavorite,
  variant = "card",
}: ShopFavoriteButtonProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)
  const [isPending, startTransition] = useTransition()

  function handleFavorite(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    if (loading) return
    if (!user) {
      openAuthModal("login")
      return
    }

    setIsFavorite((current) => !current)
    startTransition(async () => {
      const result = await toggleFavorite(productId, "individual")
      setIsFavorite(result.isFavorite)
      if (result.isFavorite) {
        toast.success("Добавлено в избранное")
      } else {
        toast("Удалено из избранного")
      }
      router.refresh()
    })
  }

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={handleFavorite}
        disabled={loading || isPending}
        className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-black transition disabled:opacity-60 ${
          isFavorite
            ? "border-red-500 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-black/10 bg-white text-[#554b43] hover:border-red-200 hover:bg-red-50 hover:text-red-500"
        }`}
      >
        <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
        {isFavorite ? "В избранном" : "В избранное"}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleFavorite}
      disabled={loading || isPending}
      aria-label={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
      className={`absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition disabled:opacity-60 ${
        isFavorite
          ? "bg-red-500 text-white shadow-red-500/25"
          : "bg-white/90 text-[#6e655e] backdrop-blur hover:bg-white hover:text-red-500"
      }`}
    >
      <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
    </button>
  )
}
