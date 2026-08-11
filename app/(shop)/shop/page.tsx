import { permanentRedirect } from "next/navigation"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"
import { ShopHome } from "@/components/shop/shop-home"
import { ShopCatalog } from "@/components/shop/shop-catalog"

export const dynamic = "force-dynamic"

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const query = await searchParams
  const legacyType = Array.isArray(query.type) ? query.type[0] : query.type
  if (legacyType && /^[a-z0-9-]+$/i.test(legacyType)) {
    const cleanParams = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (key === "type" || value == null) continue
      for (const item of Array.isArray(value) ? value : [value]) cleanParams.append(key, item)
    }
    const suffix = cleanParams.size > 0 ? `?${cleanParams.toString()}` : ""
    permanentRedirect(`/${legacyType}${suffix}`)
  }

  const [productTypes, products] = await Promise.all([getProductTypes(), getShopProducts()])
  const searchQuery = Array.isArray(query.q) ? query.q[0] : query.q
  if (searchQuery?.trim()) {
    return <ShopCatalog productTypes={productTypes} products={products} />
  }
  return <ShopHome productTypes={productTypes} products={products} />
}
