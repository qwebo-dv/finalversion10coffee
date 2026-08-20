import type { Metadata } from "next"
import { CartProvider } from "@/providers/cart-provider"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ShopHeader } from "@/components/shop/shop-header"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = "force-dynamic"

export default async function RetailCabinetLayout({ children }: { children: React.ReactNode }) {
  const [productTypes, products] = await Promise.all([getProductTypes(), getShopProducts()])

  return (
    <CartProvider sessionScope="individual">
      <div className="flex min-h-screen flex-col">
        <ShopHeader products={products} productTypes={productTypes} />
        <div className="flex-1"><DashboardShell mode="retail">{children}</DashboardShell></div>
      </div>
    </CartProvider>
  )
}
