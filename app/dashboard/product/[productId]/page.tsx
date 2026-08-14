import { notFound } from "next/navigation"
import { getProductById, getFavoriteProductIds } from "@/lib/actions/products"
import { getCoffeeBrewingGuides } from "@/lib/actions/coffee-brewing-guides"
import { ProductDetail } from "@/components/dashboard/product-detail"

interface ProductPageProps {
  params: Promise<{ productId: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params
  const [product, favoriteIds, coffeeBrewingGuides] = await Promise.all([
    getProductById(productId),
    getFavoriteProductIds(),
    getCoffeeBrewingGuides(),
  ])

  if (!product) {
    notFound()
  }

  return (
    <ProductDetail
      product={product}
      isFavorite={favoriteIds.includes(product.id)}
      coffeeBrewingGuides={coffeeBrewingGuides}
    />
  )
}
