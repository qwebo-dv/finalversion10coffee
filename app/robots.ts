import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/dashboard/"],
      },
    ],
    sitemap: [
      "https://10coffee.ru/sitemap.xml",
      "https://shop.10coffee.ru/shop/sitemap.xml",
    ],
  }
}
