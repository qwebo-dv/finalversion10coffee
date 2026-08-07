"use client"

import { useEffect, useState } from "react"
import { Coffee, Loader2, Star } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { getMyReviews, type MyReview } from "@/lib/actions/products"
import { StarRating } from "@/components/shop/star-rating"

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyReviews().then((items) => {
      setReviews(items)
      setLoading(false)
    })
  }, [])

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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Мои отзывы</h1>
        <p className="text-muted-foreground">Отзывы, которые вы оставили на товары</p>
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#faead5]">
            <Star className="h-7 w-7 text-[#e6610d]/40" />
          </div>
          <h3 className="mt-4 text-lg font-medium">Пока нет отзывов</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Оцените товары на странице магазина — ваши отзывы появятся здесь
          </p>
          <Link href="/shop" className="mt-4 text-sm font-bold text-[#5b328a] hover:underline">
            Перейти в магазин
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="flex gap-4 rounded-2xl border bg-white p-4">
              <Link href={`/shop/${review.product.slug}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#faead5]">
                {review.product.image ? (
                  <Image src={review.product.image} alt={review.product.name} fill sizes="64px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Coffee className="h-6 w-6 text-[#e6610d]/30" />
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/shop/${review.product.slug}`} className="truncate text-sm font-bold text-neutral-900 hover:text-[#5b328a] transition-colors">
                    {review.product.name}
                  </Link>
                  <StarRating value={review.rating} showValue={false} size="sm" />
                </div>
                {review.comment && <p className="mt-2 text-sm leading-6 text-neutral-600">{review.comment}</p>}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDate(review.created_at)}</span>
                  <span className="text-[#5b328a] font-semibold">{review.rating} / 5</span>
                  {review.status === "pending" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                      На модерации
                    </span>
                  )}
                  {review.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">
                      Отклонён
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
