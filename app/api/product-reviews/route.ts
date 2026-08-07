import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import configPromise from "@payload-config"

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const product = Number(body.product)
  const rating = Number(body.rating)

  if (!Number.isInteger(product) || product <= 0) {
    return NextResponse.json({ error: "Неверный товар" }, { status: 400 })
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 })
  }

  const authorName = typeof body.authorName === "string" ? body.authorName.trim() : ""
  const comment = typeof body.comment === "string" ? body.comment.trim() : ""
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : ""

  try {
    const payload = await getPayload({ config: configPromise })
    const doc = await payload.create({
      collection: "product-reviews",
      data: {
        product,
        rating,
        authorName: authorName || null,
        comment: comment || null,
        clientId: clientId || null,
        status: "pending",
      },
    })
    return NextResponse.json({
      success: true,
      review: {
        id: String(doc.id),
        rating: doc.rating,
        comment: doc.comment || null,
        created_at: doc.createdAt,
        status: "pending",
      },
    })
  } catch (error) {
    console.error("[product-reviews] create failed", error)
    return NextResponse.json({ error: "Не удалось сохранить отзыв" }, { status: 500 })
  }
}
