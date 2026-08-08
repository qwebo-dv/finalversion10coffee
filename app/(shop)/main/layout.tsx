import { CartProvider } from "@/providers/cart-provider"
import { NotificationProvider } from "@/providers/notification-provider"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ShopHeader } from "@/components/shop/shop-header"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"

export const dynamic = "force-dynamic"

export default async function RetailCabinetLayout({ children }: { children: React.ReactNode }) {
  const [productTypes, products] = await Promise.all([getProductTypes(), getShopProducts()])

  return (
    <CartProvider>
      <NotificationProvider>
        <div className="flex min-h-screen flex-col">
          <ShopHeader products={products} productTypes={productTypes} />
          <div className="flex-1"><DashboardShell mode="retail">{children}</DashboardShell></div>
        </div>
      </NotificationProvider>
    </CartProvider>
  )
}
