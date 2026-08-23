"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"
import { unstable_cache } from "next/cache"
import type { News } from "@/types"

interface NewsItemRecord {
  cover_image_id?: number | null
  cover_image?: number | string | null
  content?: LexicalNode | null
  [key: string]: unknown
}

interface LexicalNode {
  type?: string
  value?: { id?: number }
  src?: string
  root?: LexicalNode
  children?: LexicalNode[]
}

interface MediaRecord extends PayloadMediaRef {
  id: number
}

function isLexicalNode(node: LexicalNode | null | undefined): node is LexicalNode {
  return Boolean(node)
}

async function resolveMediaUrls<T extends NewsItemRecord>(items: T[]) {
  if (!items.length) return items

  // Collect all numeric media IDs from cover_image_id or cover_image
  const mediaIds = items
    .map((item) => item.cover_image_id ?? item.cover_image)
    .filter((id) => typeof id === "number")

  // Also collect media IDs from Lexical rich-text content (upload nodes)
  const contentMediaIds: number[] = []
  const uploadMediaId = (node: LexicalNode): number | undefined => {
    if (node.type !== "upload") return undefined
    const v = node.value as unknown
    if (typeof v === "number") return v
    if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "number") {
      return (v as { id: number }).id
    }
    return undefined
  }
  function walkLexical(node: LexicalNode | null | undefined) {
    if (!node) return
    const uid = uploadMediaId(node)
    if (typeof uid === "number") contentMediaIds.push(uid)
    if (Array.isArray(node.children)) {
      node.children.forEach(walkLexical)
    }
  }
  for (const item of items) {
    if (item.content && typeof item.content === "object") {
      walkLexical(item.content.root || item.content)
    }
  }

  const allIds = [...new Set([...mediaIds, ...contentMediaIds])]
  if (allIds.length === 0) return items

  // Use admin client to bypass RLS on Payload-managed media table
  const admin = createAdminClient()
  const { data: mediaItems } = await admin
    .from("media")
    .select("*")
    .in("id", allIds)

  const mediaMap = new Map(
    ((mediaItems || []) as MediaRecord[]).map((m) => [m.id, getMediaUrl(m, ["card", "full", "thumbnail"])])
  )

  // Patch upload nodes in Lexical content with resolved src
  function patchLexical(node: LexicalNode | null | undefined): LexicalNode | null | undefined {
    if (!node) return node
    const uid = uploadMediaId(node)
    if (typeof uid === "number") {
      const resolvedUrl = mediaMap.get(uid)
      if (resolvedUrl) {
        return { ...node, src: resolvedUrl }
      }
    }
    if (Array.isArray(node.children)) {
      return { ...node, children: node.children.map(patchLexical).filter(isLexicalNode) }
    }
    return node
  }

  return items.map((item) => {
    let content = item.content
    if (content && typeof content === "object" && content.root) {
      content = { ...content, root: patchLexical(content.root) ?? undefined }
    }

    return {
      ...item,
      content,
      cover_image:
        typeof item.cover_image_id === "number"
          ? mediaMap.get(item.cover_image_id) || null
          : typeof item.cover_image === "number"
            ? mediaMap.get(item.cover_image) || null
            : item.cover_image,
    }
  })
}

export async function getNewsPaginated(offset: number, limit: number = 10): Promise<{ items: News[]; total: number }> {
  return getCachedNewsPaginated(offset, limit)
}

const getCachedNewsPaginated = unstable_cache(async (offset: number, limit: number = 10): Promise<{ items: News[]; total: number }> => {
  const supabase = await createClient()

  const { data, count } = await supabase
    .from("news")
    .select("*", { count: "exact" })
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1)

  const resolved = await resolveMediaUrls(data || [])

  return {
    items: resolved as unknown as News[],
    total: count || 0,
  }
}, ["news-paginated"], { revalidate: 60, tags: ["news-paginated"] })

export async function getNewsById(id: string): Promise<News | null> {
  return getCachedNewsById(id)
}

export async function getNewsBySlug(slug: string): Promise<News | null> {
  let normalizedSlug = slug.trim().toLowerCase()
  try { normalizedSlug = decodeURIComponent(normalizedSlug) } catch { return null }
  if (!normalizedSlug) return null

  const supabase = await createClient()
  const { data: item } = await supabase
    .from("news")
    .select("*")
    .eq("slug", normalizedSlug)
    .eq("is_published", true)
    .maybeSingle()

  if (!item) return null
  const [resolved] = await resolveMediaUrls([item as NewsItemRecord])
  return resolved as unknown as News
}

async function getCachedNewsById(id: string): Promise<News | null> {
  const supabase = await createClient()

  const { data: item } = await supabase
    .from("news")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single()

  if (!item) return null

  const [resolved] = await resolveMediaUrls([item])
  return resolved as unknown as News
}
