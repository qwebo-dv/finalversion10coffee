import type { Payload } from "payload"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"

interface LexNode {
  type?: string
  children?: LexNode[]
  value?: unknown
  src?: string
  [key: string]: unknown
}

function nodeMediaId(node: LexNode): number | undefined {
  if (node.type !== "upload") return undefined
  const v = node.value
  if (typeof v === "number") return v
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "number") {
    return (v as { id: number }).id
  }
  return undefined
}

function collectMediaIds(node: LexNode | null | undefined, ids: Set<number>) {
  if (!node) return
  const id = nodeMediaId(node)
  if (typeof id === "number") ids.add(id)
  if (Array.isArray(node.children)) node.children.forEach((child) => collectMediaIds(child, ids))
}

function patchNode(node: LexNode | null | undefined, urlById: Map<number, string>): LexNode | null | undefined {
  if (!node) return node
  let out: LexNode = node
  if (node.type === "upload" && !node.src) {
    const id = nodeMediaId(node)
    const url = typeof id === "number" ? urlById.get(id) : undefined
    if (url) out = { ...node, src: url }
  }
  if (Array.isArray(out.children)) {
    out = {
      ...out,
      children: out.children
        .map((child) => patchNode(child, urlById))
        .filter((child): child is LexNode => Boolean(child)),
    }
  }
  return out
}

/**
 * Resolves MoySklad/Payload media referenced by Lexical "upload" nodes inside a
 * document's richText `content`, writing a concrete image URL into each node's
 * `src`. Works whether the upload value is a bare media id or a populated media
 * object, so inline images render on the front regardless of query depth.
 */
export async function resolveLexicalMedia<T extends { content?: unknown }>(
  doc: T,
  payload: Payload
): Promise<T> {
  const content = doc?.content as { root?: LexNode } | undefined
  if (!content || typeof content !== "object" || !content.root) return doc

  const ids = new Set<number>()
  collectMediaIds(content.root, ids)
  if (ids.size === 0) return doc

  const { docs } = await payload.find({
    collection: "media",
    where: { id: { in: Array.from(ids) } },
    limit: ids.size,
    depth: 0,
  })

  const urlById = new Map<number, string>()
  for (const media of docs as (PayloadMediaRef & { id?: number })[]) {
    const url = getMediaUrl(media as PayloadMediaRef, ["full", "card", "thumbnail"])
    if (url && typeof media.id === "number") urlById.set(media.id, url)
  }

  return { ...doc, content: { ...content, root: patchNode(content.root, urlById) } }
}
