"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { unstable_cache, revalidateTag } from "next/cache"
import { resolveLexicalMedia } from "@/lib/lexical-media"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"

interface BlogPostRecord {
  id?: number
  coverImage?: number | { id?: number } | null
  content?: unknown
  [key: string]: unknown
}

async function resolveBlogCoverImages<T extends BlogPostRecord>(items: T[], payload: Awaited<ReturnType<typeof getPayload>>): Promise<T[]> {
  if (!items.length) return items

  const mediaIds = items
    .map((item) => {
      const v = item.coverImage
      if (typeof v === "number") return v
      if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "number") return (v as { id: number }).id
      return null
    })
    .filter((id): id is number => typeof id === "number")

  if (mediaIds.length === 0) return items

  const { docs } = await payload.find({
    collection: "media",
    where: { id: { in: mediaIds } },
    limit: mediaIds.length,
    depth: 0,
  })

  const urlById = new Map<number, string>()
  for (const media of docs as (PayloadMediaRef & { id?: number })[]) {
    const url = getMediaUrl(media as PayloadMediaRef, ["card", "full", "thumbnail"])
    if (url && typeof media.id === "number") urlById.set(media.id, url)
  }

  return items.map((item) => {
    const v = item.coverImage
    let resolvedUrl: string | null = null
    if (typeof v === "number") {
      resolvedUrl = urlById.get(v) || null
    } else if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "number") {
      resolvedUrl = urlById.get((v as { id: number }).id) || null
    }
    return { ...item, coverImage: resolvedUrl } as T
  })
}

// ── Public site actions (existing) ──────────────────────────

const getCachedBlogPosts = unstable_cache(async (page = 1, limit = 9) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: "blog_posts",
    where: {
      isPublished: { equals: true },
    },
    sort: "-publishedAt",
    page,
    limit,
    depth: 1,
  })

  return {
    posts: result.docs,
    totalPages: result.totalPages,
    page: result.page || 1,
    totalDocs: result.totalDocs,
  }
}, ["blog-posts"], { revalidate: 300 })

export async function getBlogPosts(page = 1, limit = 9) {
  return getCachedBlogPosts(page, limit)
}

const getCachedBlogPost = unstable_cache(async (slug: string) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: "blog_posts",
    where: {
      slug: { equals: slug },
      isPublished: { equals: true },
    },
    limit: 1,
    depth: 1,
  })

  const doc = result.docs[0] || null
  return doc ? await resolveLexicalMedia(doc, payload) : null
}, ["blog-post"], { revalidate: 300 })

export async function getBlogPost(slug: string) {
  return getCachedBlogPost(slug)
}

// ── Dashboard actions ───────────────────────────────────────

export async function getBlogPostsPaginated(offset: number, limit: number = 10): Promise<{ items: BlogPostRecord[]; total: number }> {
  return getCachedBlogPostsPaginated(offset, limit)
}

const getCachedBlogPostsPaginated = unstable_cache(async (offset: number, limit: number = 10): Promise<{ items: BlogPostRecord[]; total: number }> => {
  const payload = await getPayload({ config: configPromise })

  const page = Math.floor(offset / limit) + 1
  const result = await payload.find({
    collection: "blog_posts",
    where: { isPublished: { equals: true } },
    sort: "-publishedAt",
    page,
    limit,
    depth: 1,
  })

  const withCovers = await resolveBlogCoverImages(result.docs, payload)

  return {
    items: withCovers,
    total: result.totalDocs,
  }
}, ["blog-posts-paginated"], { revalidate: 60, tags: ["blog-posts-paginated"] })

export async function getBlogPostById(id: string): Promise<BlogPostRecord | null> {
  const payload = await getPayload({ config: configPromise })

  const doc = await payload.findByID({
    collection: "blog_posts",
    id,
    depth: 1,
  }).catch(() => null)

  if (!doc || !doc.isPublished) return null

  const resolved = await resolveLexicalMedia(doc, payload)
  const [withCover] = await resolveBlogCoverImages([resolved], payload)
  return withCover
}

export function revalidateBlogCache() {
  try {
    revalidateTag("blog-posts-paginated")
  } catch {}
}
