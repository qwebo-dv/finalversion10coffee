import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dbQuery } from "@/lib/db"
import { isValidRussianPhone, normalizeRussianPhone } from "@/lib/utils/phone"

async function syncPayloadClientProfile(params: {
  supabaseId: string
  email?: string | null
  fullName?: string | null
  phone?: string | null
  customerType?: "individual" | "business"
}) {
  try {
    const { getPayload } = await import("payload")
    const payloadConfig = await import("@payload-config")
    const payload = await getPayload({ config: payloadConfig.default })
    const updateData: { fullName?: string; phone?: string } = {}

    if (params.fullName) updateData.fullName = params.fullName
    if (params.phone) updateData.phone = params.phone

    if (!Object.keys(updateData).length) return

    const { docs } = await payload.find({
      collection: "clients",
      where: {
        or: [
          { supabaseId: { equals: params.supabaseId } },
          { email: { equals: params.email || "" } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    const existingClient = docs[0]

    if (existingClient?.id) {
      await payload.update({
        collection: "clients",
        id: existingClient.id,
        data: updateData,
      })
      return
    }

    if (params.email && params.fullName) {
      await payload.create({
        collection: "clients",
        data: {
          ...updateData,
          email: params.email,
          supabaseId: params.supabaseId,
          fullName: params.fullName,
          customerType: params.customerType || "business",
          salesChannel: params.customerType === "individual" ? "retail" : "wholesale",
        },
      })
    }
  } catch (error) {
    console.error("Failed to sync client profile to Payload:", error)
  }
}

export async function GET() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  return NextResponse.json({ user })
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
  const data = body?.data && typeof body.data === "object"
    ? body.data as Record<string, unknown>
    : undefined
  const password = typeof body?.password === "string" ? body.password : undefined
  const phoneProvided = Boolean(data && Object.prototype.hasOwnProperty.call(data, "phone"))
  const normalizedData = data ? { ...data } : undefined

  if (phoneProvided) {
    const rawPhone = typeof data?.phone === "string" ? data.phone : ""
    if (!isValidRussianPhone(rawPhone)) {
      return NextResponse.json({ error: "Введите корректный мобильный телефон" }, { status: 400 })
    }
    normalizedData!.phone = normalizeRussianPhone(rawPhone)
  }

  const { data: result, error } = await auth.auth.updateUser({ data: normalizedData, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (normalizedData) {
    const fullName = typeof normalizedData.full_name === "string" ? normalizedData.full_name : null
    const phone = typeof normalizedData.phone === "string" ? normalizedData.phone : null

    await dbQuery(
      `update public.client_profiles
          set full_name = coalesce($2, full_name),
              phone = coalesce($3, phone),
              updated_at = now()
        where id = $1`,
      [
        user.id,
        fullName,
        phone,
      ]
    )

    await syncPayloadClientProfile({
      supabaseId: user.id,
      email: result.user?.email || user.email,
      fullName,
      phone,
      customerType: user.user_metadata?.customer_type === "individual" ? "individual" : "business",
    })
  }

  return NextResponse.json({ user: result.user })
}
