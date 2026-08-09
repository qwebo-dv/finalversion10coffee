import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasBusinessSession = Boolean(request.cookies.get(SESSION_COOKIE_NAMES.business)?.value)
  const hasIndividualSession = Boolean(request.cookies.get(SESSION_COOKIE_NAMES.individual)?.value)

  if (pathname.startsWith("/dashboard") && !hasBusinessSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.searchParams.set("auth", "login")
    return NextResponse.redirect(url)
  }

  if (pathname === "/main" || pathname.startsWith("/main/")) {
    if (hasIndividualSession) return NextResponse.next({ request })

    const url = request.nextUrl.clone()
    url.pathname = "/shop"
    url.searchParams.set("auth", "login")
    return NextResponse.redirect(url)
  }

  if ((pathname === "/login" || pathname === "/register") && hasBusinessSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}
