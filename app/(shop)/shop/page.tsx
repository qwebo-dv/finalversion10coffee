import { getProductTypes, getShopProducts } from "@/lib/actions/products"
import { ShopCatalog } from "@/components/shop/shop-catalog"

export const dynamic = "force-dynamic"

export default async function ShopPage() {
  const [productTypes, products] = await Promise.all([getProductTypes(), getShopProducts()])
  return <ShopCatalog productTypes={productTypes} products={products} />
}
