import { Suspense } from "react"
import type { Metadata } from "next"
import { HtmlWrapper } from "@/components/shared/html-wrapper"
import { AuthModal } from "@/components/auth/auth-modal"
import { getSiteSettings } from "@/lib/actions/site-settings"
import { AuthProvider } from "@/providers/auth-provider"
import "@/components/landing/_shared/landing-globals.css"

export const metadata: Metadata = {
  title: "Оптовые поставки кофе по всей России - 10coffee",
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let announcement: string | null = null
  try {
    const settings = await getSiteSettings()
    if (settings?.loginAnnouncementEnabled && settings?.loginAnnouncement) {
      announcement = settings.loginAnnouncement
    }
  } catch {
    // Settings not yet initialized — skip
  }

  return (
    <HtmlWrapper>
      <AuthProvider sessionScope="business">
        <div className="landing-scope">
          {children}
        </div>
      </AuthProvider>

      <Suspense fallback={null}>
        <AuthModal announcement={announcement} customerType="business" />
      </Suspense>
    </HtmlWrapper>
  )
}
