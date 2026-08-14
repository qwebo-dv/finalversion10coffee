import type { CollectionBeforeValidateHook } from "payload"
import { slugify } from "@/lib/slug"

type SlugData = Record<string, unknown> & { slug?: unknown }

interface EnsureSlugOptions {
  collection: string
  sourceField: "name" | "title"
}

async function uniqueSlug({
  baseSlug,
  collection,
  currentId,
  payload,
}: {
  baseSlug: string
  collection: string
  currentId: string | number | undefined
  payload: Parameters<CollectionBeforeValidateHook>[0]["req"]["payload"]
}): Promise<string> {
  let suffix = 1
  let candidate = baseSlug

  while (true) {
    const { docs } = await payload.find({
      // payload-types.ts is stale in this project and does not list current collections.
      collection: collection as never,
      where: { slug: { equals: candidate } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const records = docs as unknown as Array<{ id?: string | number }>
    const collision = records.some((document) => String(document.id) !== String(currentId))
    if (!collision) return candidate

    suffix += 1
    candidate = `${baseSlug}-${suffix}`
  }
}

export function ensureSlug({ collection, sourceField }: EnsureSlugOptions): CollectionBeforeValidateHook {
  return async ({ data, originalDoc, req }) => {
    const nextData = data as SlugData | undefined
    if (!nextData) return data

    const source = nextData[sourceField] ?? (originalDoc as SlugData | undefined)?.[sourceField]
    const enteredSlug = typeof nextData.slug === "string" ? nextData.slug : ""
    const originalSlug = typeof (originalDoc as SlugData | undefined)?.slug === "string"
      ? String((originalDoc as SlugData).slug)
      : ""
    const baseSlug = slugify(enteredSlug || String(source || ""))

    if (!baseSlug) return data

    // Preserve an unchanged slug on update and avoid an unnecessary database query.
    if (originalSlug && baseSlug === originalSlug) {
      nextData.slug = originalSlug
      return nextData
    }

    nextData.slug = await uniqueSlug({
      baseSlug,
      collection,
      currentId: typeof (originalDoc as SlugData | undefined)?.id === "string" || typeof (originalDoc as SlugData | undefined)?.id === "number"
        ? (originalDoc as SlugData & { id: string | number }).id
        : undefined,
      payload: req.payload,
    })
    return nextData
  }
}
