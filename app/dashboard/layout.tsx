import type { Metadata } from "next"
import { Suspense } from "react"
import { HtmlWrapper } from "@/components/shared/html-wrapper"
import { AuthProvider } from "@/providers/auth-provider"
import { CartProvider } from "@/providers/cart-provider"
import { GuestCartProvider } from "@/providers/guest-cart-provider"
import { NotificationProvider } from "@/providers/notification-provider"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ShopHeader } from "@/components/shop/shop-header"
import { ShopFooter } from "@/components/shop/shop-footer"
import { AuthModal } from "@/components/auth/auth-modal"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"
import { getCurrentUser } from "@/lib/actions/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Личный кабинет - 10coffee",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser().catch(() => null)
  const isIndividual = user?.user_metadata?.customer_type === "individual"

  const [productTypes, products] = await Promise.all([getProductTypes(), getShopProducts()])

  return (
    <HtmlWrapper>
      <AuthProvider>
        <GuestCartProvider>
          <CartProvider>
            <NotificationProvider>
              <div className="flex min-h-screen flex-col">
                {isIndividual && <ShopHeader products={products} productTypes={productTypes} />}
                <div className="flex-1">
                  <DashboardShell>{children}</DashboardShell>
                </div>
                {isIndividual && <ShopFooter />}
              </div>
            </NotificationProvider>
          </CartProvider>
        </GuestCartProvider>
      </AuthProvider>

      <Suspense fallback={null}>
        <AuthModal customerType={isIndividual ? "individual" : undefined} />
      </Suspense>
    </HtmlWrapper>
  )
}
