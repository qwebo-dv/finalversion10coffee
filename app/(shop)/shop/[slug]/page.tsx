import { notFound } from "next/navigation"
import { getCachedShopProducts, getFavoriteProductIds, getProductBySlug, getProductTypes } from "@/lib/actions/products"
import { getCoffeeBrewingGuides } from "@/lib/actions/coffee-brewing-guides"
import { ShopProduct } from "@/components/shop/shop-product"

export const dynamic = "force-dynamic"

interface ShopProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ShopProductPage({ params }: ShopProductPageProps) {
  const { slug } = await params
  const [product, products, productTypes, favoriteIds, coffeeBrewingGuides] = await Promise.all([
    getProductBySlug(slug),
    getCachedShopProducts(),
    getProductTypes(),
    getFavoriteProductIds("individual"),
    getCoffeeBrewingGuides(),
  ])
  if (!product) notFound()

  return <ShopProduct product={product} products={products} productTypes={productTypes} isFavorite={favoriteIds.includes(product.id)} coffeeBrewingGuides={coffeeBrewingGuides} />
}
