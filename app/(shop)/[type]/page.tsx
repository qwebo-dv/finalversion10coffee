import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShopCatalog } from "@/components/shop/shop-catalog"
import { getCachedShopProducts, getCategories, getFavoriteProductIds, getProductTypes } from "@/lib/actions/products"
import type { ProductType } from "@/types"

export const dynamic = "force-dynamic"

interface CategoryPageProps {
  params: Promise<{ type: string }>
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { type } = await params
  const productTypes = await getProductTypes()
  const category = productTypes.find((item) => item.slug === type)
  if (!category) return {}

  return {
    title: `${category.name} — купить в интернет-магазине 10coffee`,
    description: `${category.name}: актуальные цены, фотографии и описания товаров с доставкой от 10coffee.`,
    alternates: { canonical: `/${category.slug}` },
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { type } = await params
  const productTypes = await getProductTypes()
  if (!productTypes.some((item) => item.slug === type)) notFound()

  const [products, categoryGroups, favoriteIds] = await Promise.all([
    getCachedShopProducts(),
    getCategories(type as ProductType),
    getFavoriteProductIds("individual"),
  ])

  return <ShopCatalog productTypes={productTypes} products={products} favoriteIds={favoriteIds} initialType={type} categoryGroups={categoryGroups} />
}
