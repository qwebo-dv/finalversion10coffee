import { notFound } from "next/navigation"
import { getProductBySlug, getProductTypes, getShopProducts } from "@/lib/actions/products"
import { ShopProduct } from "@/components/shop/shop-product"

export const dynamic = "force-dynamic"

interface ShopProductPageProps {
  params: Promise<{ slug: string }>
}

export default async function ShopProductPage({ params }: ShopProductPageProps) {
  const { slug } = await params
  const [product, products, productTypes] = await Promise.all([getProductBySlug(slug), getShopProducts(), getProductTypes()])
  if (!product) notFound()

  return <ShopProduct product={product} products={products} productTypes={productTypes} />
}
