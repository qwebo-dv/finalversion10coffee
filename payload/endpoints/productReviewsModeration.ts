import type { Endpoint } from "payload"
import { dbQuery } from "@/lib/db"

interface ReviewRow {
  id: string | number
  product_id: string | number | null
  product_name: string | null
  product_slug: string | null
  author_name: string | null
  client_id: string | null
  rating: string | number
  comment: string | null
  status: string
  created_at: string | Date
}

function isAdminUser(user: { collection?: string; role?: string } | null): boolean {
  return !!user && user.collection === "admins" && user.role === "admin"
}

function reviewSummary(row: ReviewRow) {
  return {
    id: String(row.id),
    rating: Number(row.rating) || 0,
    comment: row.comment || null,
    authorName: row.author_name || null,
    clientId: row.client_id || null,
    status: row.status || "pending",
    createdAt: new Date(row.created_at).toISOString(),
    product:
      row.product_id == null
        ? null
        : {
            id: String(row.product_id),
            name: row.product_name || `Товар #${row.product_id}`,
            slug: row.product_slug || String(row.product_id),
          },
  }
}

export const productReviewsModerationHandler: Endpoint["handler"] = async (req) => {
  const user = req.user as { collection?: string; role?: string } | null
  if (!isAdminUser(user)) {
    return Response.json({ error: "Доступ разрешён только суперадминистратору" }, { status: 403 })
  }

  const method = req.method || "GET"

  if (method === "GET") {
    try {
      const result = await dbQuery<ReviewRow>(`
        SELECT
          r.id,
          r.product_id,
          p.name AS product_name,
          p.slug AS product_slug,
          r.author_name,
          r.client_id,
          r.rating,
          r.comment,
          r.status,
          r.created_at
        FROM product_reviews r
        LEFT JOIN products p ON p.id = r.product_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at DESC
        LIMIT 100
      `)
      return Response.json({
        total: result.rows.length,
        reviews: result.rows.map(reviewSummary),
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
    const action = body.action
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Неверный ID отзыва" }, { status: 400 })
    }
    if (action !== "approve" && action !== "reject") {
      return Response.json({ error: "Неверное действие" }, { status: 400 })
    }

    try {
      const result = await dbQuery<ReviewRow>(`
        UPDATE product_reviews
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING
          id,
          product_id,
          (SELECT p.name FROM products p WHERE p.id = product_reviews.product_id) AS product_name,
          (SELECT p.slug FROM products p WHERE p.id = product_reviews.product_id) AS product_slug,
          author_name,
          client_id,
          rating,
          comment,
          status,
          created_at
      `, [id, action === "approve" ? "approved" : "rejected"])
      if (result.rows.length === 0) {
        return Response.json({ error: "Отзыв не найден" }, { status: 404 })
      }
      return Response.json({ success: true, review: reviewSummary(result.rows[0]) })
    } catch (error) {
      console.error("[reviews-moderation] update failed", error)
      return Response.json({ error: "Не удалось обновить отзыв" }, { status: 500 })
    }
  }

  return Response.json({ error: "Метод не поддерживается" }, { status: 405 })
}
