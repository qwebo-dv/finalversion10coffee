import { getShopProducts } from "@/lib/actions/products"
import { getYooKassaConfig, isYooKassaReady } from "@/lib/payments/yookassa"
import { ShopCheckout } from "@/components/shop/shop-checkout"
import { canUseYandexDeliveryPreview } from "@/lib/yandex-delivery-preview"

export const dynamic = "force-dynamic"

export default async function ShopCheckoutPage() {
  const [products, paymentConfig, yandexDeliveryPreviewEnabled] = await Promise.all([
    getShopProducts(),
    getYooKassaConfig(),
    canUseYandexDeliveryPreview(),
  ])

  return <ShopCheckout
    products={products}
    onlinePaymentReady={isYooKassaReady(paymentConfig)}
    yandexDeliveryPreviewEnabled={yandexDeliveryPreviewEnabled}
  />
}
