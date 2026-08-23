import type { MetadataRoute } from "next"
import { getNewsPaginated } from "@/lib/actions/news"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://10coffee.ru",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://10coffee.ru/vakansii",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://10coffee.ru/news",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://10coffee.ru/loyalty",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]

  try {
    const { items } = await getNewsPaginated(0, 500)
    return [
      ...staticPages,
      ...items.map((item) => ({
        url: `https://10coffee.ru/news/${item.slug}`,
        lastModified: item.updated_at ? new Date(item.updated_at) : item.published_at ? new Date(item.published_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ]
  } catch {
    return staticPages
  }
}
