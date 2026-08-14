import { NextRequest, NextResponse } from "next/server"
import { getPayload, type Where } from "payload"
import configPromise from "@payload-config"
import { createClient } from "@/lib/supabase/server"

interface PayloadOrderItem {
  productId?: string | number | null
}

interface PayloadOrderDoc {
  items?: PayloadOrderItem[] | null
}

interface ReviewEligibilityPayload {
  find: (options: {
    collection: string
    where: Where
    limit: number
    depth: number
  }) => Promise<{ docs: Array<{ id?: string | number; items?: PayloadOrderItem[] | null }> }>
}

interface ReviewCreationPayload {
  create: (options: {
    collection: "product-reviews"
    data: {
      product: number
      rating: number
      authorName: string | null
      comment: string | null
      clientId: string
      status: "pending"
    }
  }) => Promise<{
    id: string | number
    rating: number
    comment?: string | null
    createdAt?: string
  }>
}

async function hasReceivedProductPurchase(params: {
  userId: string
  email: string | null | undefined
  productId: number
}) {
  const payload = await getPayload({ config: configPromise })
  const reviewPayload = payload as unknown as ReviewEligibilityPayload
  const { docs: clients } = await reviewPayload.find({
    collection: "clients",
    where: { supabaseId: { equals: params.userId } },
    limit: 1,
    depth: 0,
  })

  const ownerConditions: Where[] = []
  if (clients[0]?.id) ownerConditions.push({ client: { equals: clients[0].id } })
  if (params.email) ownerConditions.push({ customerEmail: { equals: params.email.toLowerCase() } })
  if (ownerConditions.length === 0) return false

  const { docs: orders } = await reviewPayload.find({
    collection: "orders",
    where: {
      and: [
        { salesChannel: { equals: "retail" } },
        { customerType: { equals: "individual" } },
        { paymentStatus: { equals: "paid" } },
        { status: { equals: "delivered" } },
        { or: ownerConditions },
      ],
    },
    limit: 500,
    depth: 0,
  })

  return (orders as PayloadOrderDoc[]).some((order) =>
    (order.items || []).some((item) => String(item.productId) === String(params.productId)),
  )
}

async function getIndividualUser() {
  const auth = await createClient("individual")
  const { data: { user } } = await auth.auth.getUser()
  if (!user || user.user_metadata?.customer_type !== "individual") return null
  return user
}

export async function GET(request: NextRequest) {
  const user = await getIndividualUser()
  if (!user) return NextResponse.json({ error: "Требуется авторизация покупателя" }, { status: 401 })

  const product = Number(request.nextUrl.searchParams.get("product"))
  if (!Number.isInteger(product) || product <= 0) {
    return NextResponse.json({ error: "Неверный товар" }, { status: 400 })
  }

  try {
    const canReview = await hasReceivedProductPurchase({ userId: user.id, email: user.email, productId: product })
    return NextResponse.json({ canReview })
  } catch (error) {
    console.error("[product-reviews] eligibility check failed", error)
    return NextResponse.json({ error: "Не удалось проверить историю заказов" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getIndividualUser()
  if (!user) {
    return NextResponse.json({ error: "Оставлять отзывы могут только зарегистрированные покупатели" }, { status: 401 })
  }

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
  const accountName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : ""

  try {
    const canReview = await hasReceivedProductPurchase({ userId: user.id, email: user.email, productId: product })
    if (!canReview) {
      return NextResponse.json(
        { error: "Отзыв можно оставить после получения оплаченного товара" },
        { status: 403 },
      )
    }

    const payload = await getPayload({ config: configPromise }) as unknown as ReviewCreationPayload
    const doc = await payload.create({
      collection: "product-reviews",
      data: {
        product,
        rating,
        authorName: authorName || accountName || user.email || null,
        comment: comment || null,
        clientId: user.id,
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
