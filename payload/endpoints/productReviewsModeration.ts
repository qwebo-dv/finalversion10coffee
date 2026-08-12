import type { Endpoint } from "payload"
import { canManageOperations } from "../access/adminRoles"

interface ReviewDocument {
  id: string | number
  product: string | number | { id: string | number; name?: string | null; slug?: string | null } | null
  authorName?: string | null
  clientId?: string | null
  rating?: string | number | null
  comment?: string | null
  status?: string | null
  createdAt: string
}

function reviewSummary(review: ReviewDocument) {
  const product = typeof review.product === "object" && review.product !== null
    ? review.product
    : null

  return {
    id: String(review.id),
    rating: Number(review.rating) || 0,
    comment: review.comment || null,
    authorName: review.authorName || null,
    clientId: review.clientId || null,
    status: review.status || "pending",
    createdAt: review.createdAt,
    product: product
      ? {
          id: String(product.id),
          name: product.name || `Товар #${product.id}`,
          slug: product.slug || String(product.id),
        }
      : review.product == null
        ? null
        : {
            id: String(review.product),
            name: `Товар #${review.product}`,
            slug: String(review.product),
          },
  }
}

export const productReviewsModerationHandler: Endpoint["handler"] = async (req) => {
  if (!canManageOperations(req.user)) {
    return Response.json({ error: "Недостаточно прав для модерации отзывов" }, { status: 403 })
  }

  const method = req.method || "GET"

  if (method === "GET") {
    try {
      const result = await req.payload.find({
        collection: "product-reviews",
        where: { status: { equals: "pending" } },
        sort: "-createdAt",
        limit: 100,
        depth: 1,
        overrideAccess: false,
        req,
      })
      return Response.json({
        total: result.totalDocs,
        reviews: result.docs.map((review) => reviewSummary(review as unknown as ReviewDocument)),
      })
    } catch (error) {
      console.error("[reviews-moderation] list failed", error)
      return Response.json({ error: "Не удалось загрузить отзывы" }, { status: 500 })
    }
  }

  if (method === "POST") {
    let body: { id?: string | number; action?: string }
    try {
      body = (await req.json?.()) || {}
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Неверный ID отзыва" }, { status: 400 })
    }
    if (body.action !== "approve" && body.action !== "reject") {
      return Response.json({ error: "Неверное действие" }, { status: 400 })
    }

    try {
      const review = await req.payload.update({
        collection: "product-reviews",
        id,
        data: { status: body.action === "approve" ? "approved" : "rejected" },
        depth: 1,
        overrideAccess: false,
        req,
      })
      return Response.json({
        success: true,
        review: reviewSummary(review as unknown as ReviewDocument),
      })
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 500
      if (status === 404) {
        return Response.json({ error: "Отзыв не найден" }, { status: 404 })
      }
      console.error("[reviews-moderation] update failed", error)
      return Response.json({ error: "Не удалось обновить отзыв" }, { status: 500 })
    }
  }

  return Response.json({ error: "Метод не поддерживается" }, { status: 405 })
}
