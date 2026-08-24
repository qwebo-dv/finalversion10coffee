import { getShopProducts } from "@/lib/actions/products"
import { getYooKassaConfig, isYooKassaReady } from "@/lib/payments/yookassa"
import { ShopCheckout } from "@/components/shop/shop-checkout"

export const dynamic = "force-dynamic"

export default async function ShopCheckoutPage() {
  const [products, paymentConfig] = await Promise.all([
    getShopProducts(),
    getYooKassaConfig(),
  ])

  return <ShopCheckout
    products={products}
    onlinePaymentReady={isYooKassaReady(paymentConfig)}
  />
}
