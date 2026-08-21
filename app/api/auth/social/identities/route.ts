import { NextResponse } from "next/server"
import { getCurrentUser, listSocialIdentities } from "@/lib/auth/local"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const providers = await listSocialIdentities(user.id)
  return NextResponse.json({ providers })
}
