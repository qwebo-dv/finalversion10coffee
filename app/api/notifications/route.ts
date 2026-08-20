import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getClientDiscountConfig } from "@/lib/actions/products"
import { createHash } from "node:crypto"

function discountNotificationId(clientId: string, signature: string) {
  const hex = createHash("sha256").update(`personal-discount:${clientId}:${signature}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function buildDiscountMessage(config: Awaited<ReturnType<typeof getClientDiscountConfig>>) {
  const parts: string[] = []
  if (config.discountPercent > 0) parts.push(`${config.discountPercent}% на все товары`)
  for (const rule of config.categoryDiscounts) {
    parts.push(`${rule.discountPercent}% на категорию «${rule.categoryName || "Выбранная категория"}»`)
  }
  for (const rule of config.productDiscounts || []) {
    parts.push(`${rule.discountPercent}% на товар «${rule.productName || "Выбранный товар"}»`)
  }
  return parts.length ? `Для вас действует персональная скидка: ${parts.join("; ")}. Она применится автоматически при оформлении заказа.` : ""
}

export async function GET() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) {
    return NextResponse.json({ notifications: [] }, { status: 401 })
  }

  const db = createAdminClient()
  try {
    const discountConfig = await getClientDiscountConfig("individual")
    const message = buildDiscountMessage(discountConfig)
    if (message) {
      const signature = JSON.stringify(discountConfig)
      const { error: insertError } = await db.from("notifications").insert({
        id: discountNotificationId(user.id, signature),
        client_id: user.id,
        type: "personal_discount",
        title: "Ваша персональная скидка",
        message,
        data: { discount_signature: signature },
      })
      if (insertError && (insertError as { code?: string }).code !== "23505") {
        console.error("[notifications] Не удалось создать уведомление о скидке", insertError)
      }
    }
  } catch (error) {
    console.error("[notifications] Не удалось загрузить персональную скидку", error)
  }

  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data || [] })
}

export async function PATCH(request: NextRequest) {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const db = createAdminClient()

  if (body?.all) {
    const { error } = await db
      .from("notifications")
      .update({ is_read: true })
      .eq("client_id", user.id)
      .eq("is_read", false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const { error } = await db
    .from("notifications")
    .update({ is_read: true })
    .eq("id", body.id)
    .eq("client_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
