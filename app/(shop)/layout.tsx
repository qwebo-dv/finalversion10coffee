import type { Metadata } from "next"
import { Suspense } from "react"
import { HtmlWrapper } from "@/components/shared/html-wrapper"
import { AuthProvider } from "@/providers/auth-provider"
import { GuestCartProvider } from "@/providers/guest-cart-provider"
import { NotificationProvider } from "@/providers/notification-provider"
import { PayloadAdminEditProvider } from "@/providers/payload-admin-edit-provider"
import { ShopFooter } from "@/components/shop/shop-footer"
import { AuthModal } from "@/components/auth/auth-modal"

export const metadata: Metadata = {
  title: "Магазин кофе — 10coffee",
  description: "Розничный интернет-магазин кофе, чая и аксессуаров 10coffee.",
  metadataBase: new URL("https://shop.10coffee.ru"),
  robots: { index: true, follow: true },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <HtmlWrapper>
      <AuthProvider sessionScope="individual">
        <GuestCartProvider>
          <NotificationProvider>
            <PayloadAdminEditProvider>
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
                <ShopFooter />
              </div>
            </PayloadAdminEditProvider>
          </NotificationProvider>
        </GuestCartProvider>
      </AuthProvider>

      <Suspense fallback={null}>
        <AuthModal customerType="individual" />
      </Suspense>
    </HtmlWrapper>
  )
}
