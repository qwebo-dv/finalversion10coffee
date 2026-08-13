import type { Metadata } from "next"
import { Suspense } from "react"
import { HtmlWrapper } from "@/components/shared/html-wrapper"
import { AuthProvider } from "@/providers/auth-provider"
import { CartProvider } from "@/providers/cart-provider"
import { GuestCartProvider } from "@/providers/guest-cart-provider"
import { NotificationProvider } from "@/providers/notification-provider"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AuthModal } from "@/components/auth/auth-modal"
import { getCurrentUser } from "@/lib/actions/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Личный кабинет - 10coffee",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser("business").catch(() => null)
  const isIndividual = user?.user_metadata?.customer_type === "individual"

  // Retail customers have a separate storefront and cabinet on shop.10coffee.ru.
  if (isIndividual) {
    redirect(process.env.SHOP_SITE_URL || "/main")
  }

  return (
    <HtmlWrapper>
      <AuthProvider>
        <GuestCartProvider>
          <CartProvider sessionScope="business">
            <NotificationProvider>
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">
                  <DashboardShell>{children}</DashboardShell>
                </div>
              </div>
            </NotificationProvider>
          </CartProvider>
        </GuestCartProvider>
      </AuthProvider>

      <Suspense fallback={null}>
        <AuthModal />
      </Suspense>
    </HtmlWrapper>
  )
}
