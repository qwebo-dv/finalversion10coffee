import { NextResponse } from "next/server"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"

export const dynamic = "force-dynamic"

const SHOP_URL = "https://shop.10coffee.ru"

function xml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;",
  })[character] || character)
}

export async function GET() {
  const [productTypes, products] = await Promise.all([getProductTypes(), getShopProducts()])
  const urls = [
    { loc: `${SHOP_URL}/shop`, lastmod: undefined, changefreq: "daily", priority: "1.0" },
    ...productTypes.map((type) => ({ loc: `${SHOP_URL}/${type.slug}`, lastmod: undefined, changefreq: "daily", priority: "0.8" })),
    ...products.map((product) => ({
      loc: `${SHOP_URL}/shop/${product.slug}`,
      lastmod: product.updated_at || undefined,
      changefreq: "weekly",
      priority: "0.7",
    })),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(({ loc, lastmod, changefreq, priority }) => `\n  <url>\n    <loc>${xml(loc)}</loc>${lastmod ? `\n    <lastmod>${xml(new Date(lastmod).toISOString())}</lastmod>` : ""}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`).join("")}\n</urlset>\n`

  return new NextResponse(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
