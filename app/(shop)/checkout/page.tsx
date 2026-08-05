import { getShopProducts } from "@/lib/actions/products"
import { ShopCheckout } from "@/components/shop/shop-checkout"

export const dynamic = "force-dynamic"

export default async function ShopCheckoutPage() {
  const products = await getShopProducts()
  return <ShopCheckout products={products} />
}
