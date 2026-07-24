"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { unstable_cache } from "next/cache"
import { resolveLexicalMedia } from "@/lib/lexical-media"

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
