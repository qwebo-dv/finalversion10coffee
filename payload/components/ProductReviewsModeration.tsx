"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useAuth } from "@payloadcms/ui"
import { Check, ClipboardCheck, Loader2, RefreshCw, Star, X } from "lucide-react"
import "./ProductReviewsModeration.scss"

interface ModerationReview {
  id: string
  rating: number
  comment: string | null
  authorName: string | null
  clientId: string | null
  status: string
  createdAt: string | null
  product: { id: string; name: string; slug: string } | null
}

interface ModerationResponse {
  error?: string
  total?: number
  reviews?: ModerationReview[]
}

function formatDate(value: string | null) {
  if (!value) return "Дата неизвестна"
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="moderation-review__stars">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={14} fill={value <= rating ? "#f2a515" : "none"} color={value <= rating ? "#f2a515" : "#c7c0b8"} />
      ))}
      <b>{rating}</b>
    </span>
  )
}

export default function ProductReviewsModeration() {
  const { user } = useAuth()
  const role = (user as { role?: string } | null)?.role
  const canModerate = Boolean(role && ["admin", "manager", "super_admin", "wholesale_manager", "retail_manager"].includes(role))
  const [reviews, setReviews] = useState<ModerationReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!canModerate) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/product-reviews/moderation", { credentials: "include" })
      const json = (await response.json()) as ModerationResponse
      if (!response.ok) throw new Error(json.error || "Не удалось загрузить отзывы")
      setReviews(json.reviews || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить отзывы")
    } finally {
      setLoading(false)
    }
  }, [canModerate])

  useEffect(() => {
    void load()
  }, [load])

  async function moderate(id: string, action: "approve" | "reject") {
    setUpdatingId(id)
    try {
      const response = await fetch("/api/product-reviews/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: Number(id), action }),
      })
      const json = (await response.json()) as ModerationResponse
      if (!response.ok) throw new Error(json.error || "Не удалось обновить отзыв")
      setReviews((prev) => prev.filter((review) => review.id !== id))
    } catch (moderateError) {
      setError(moderateError instanceof Error ? moderateError.message : "Не удалось обновить отзыв")
    } finally {
      setUpdatingId(null)
    }
  }

  if (!canModerate) return null

  return (
    <section className="reviews-moderation">
      <div className="reviews-moderation__header">
        <div>
          <div className="reviews-moderation__eyebrow"><ClipboardCheck size={14} /> Модерация отзывов</div>
          <h2>Ожидают публикации</h2>
          <p>Отзывы проходят проверку суперадминистратора перед публикацией на сайте.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} title="Обновить список">
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          Обновить
        </button>
      </div>

      {error && <div className="reviews-moderation__error">{error}</div>}

      {loading ? (
        <div className="reviews-moderation__loading"><Loader2 size={18} /> Загрузка…</div>
      ) : reviews.length === 0 ? (
        <div className="reviews-moderation__empty"><Check size={22} /> Отзывов на модерации нет — всё опубликовано.</div>
      ) : (
        <div className="reviews-moderation__list">
          {reviews.map((review) => (
            <article className="moderation-review" key={review.id}>
              <div className="moderation-review__top">
                <RatingStars rating={review.rating} />
                <span className="moderation-review__time">{formatDate(review.createdAt)}</span>
              </div>
              <div className="moderation-review__product">
                {review.product ? (
                  <a href={`/admin/collections/products/${review.product.id}`}>{review.product.name}</a>
                ) : (
                  <span>Товар удалён</span>
                )}
                <span className="moderation-review__author">{review.authorName || "Гость"}</span>
              </div>
              {review.comment && <p className="moderation-review__comment">{review.comment}</p>}
              <div className="moderation-review__actions">
                <button type="button" className="moderation-review__approve" disabled={updatingId === review.id} onClick={() => void moderate(review.id, "approve")}>
                  {updatingId === review.id ? <Loader2 size={14} className="is-spinning" /> : <Check size={14} />}
                  Опубликовать
                </button>
                <button type="button" className="moderation-review__reject" disabled={updatingId === review.id} onClick={() => void moderate(review.id, "reject")}>
                  {updatingId === review.id ? <Loader2 size={14} className="is-spinning" /> : <X size={14} />}
                  Отклонить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
