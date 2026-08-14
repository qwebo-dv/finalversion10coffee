"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { resolveLexicalMedia } from "@/lib/lexical-media"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"
import type { CoffeeBrewingGuide } from "@/types"

interface BlogArticle {
  title?: string
  excerpt?: string | null
  content?: unknown
  coverImage?: PayloadMediaRef | string | number | null
  isPublished?: boolean
}

interface CoffeeBrewingGuideRecord {
  id?: string | number
  title?: string
  article?: BlogArticle | string | number | null
}

function serializeArticleContent(content: unknown): string {
  if (!content) return ""
  if (typeof content === "string") return content

  try {
    return convertLexicalToHTML({ data: content as SerializedEditorState, disableContainer: true })
  } catch (error) {
    console.error("Failed to serialize coffee brewing guide:", error)
    return ""
  }
}

export async function getCoffeeBrewingGuides(): Promise<CoffeeBrewingGuide[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    // payload-types.ts is stale in this project and does not list current collections.
    collection: "coffee-brewing-guides" as never,
    where: { isVisible: { equals: true } },
    sort: "sortOrder",
    limit: 50,
    depth: 2,
  })

  const guides: Array<CoffeeBrewingGuide | null> = await Promise.all(
    (docs as unknown as CoffeeBrewingGuideRecord[]).map(async (guide): Promise<CoffeeBrewingGuide | null> => {
      const article = guide.article
      if (!article || typeof article !== "object" || !article.isPublished || !guide.title) return null

      const resolvedArticle = await resolveLexicalMedia(article, payload)
      return {
        id: String(guide.id),
        title: guide.title,
        description: resolvedArticle.excerpt || "",
        content: serializeArticleContent(resolvedArticle.content),
        image_url: getMediaUrl(resolvedArticle.coverImage, ["card", "full", "thumbnail"]) || undefined,
      }
    })
  )

  return guides.filter((guide): guide is CoffeeBrewingGuide => guide !== null)
}
