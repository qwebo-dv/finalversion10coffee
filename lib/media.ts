type MediaSizeName = "thumbnail" | "card" | "full"

interface MediaSizeRef {
  url?: string | null
  filename?: string | null
}

export interface PayloadMediaRef {
  url?: string | null
  filename?: string | null
  sizes?: Partial<Record<MediaSizeName, MediaSizeRef | null>> | null
}

function fileUrl(filename: string | null | undefined) {
  return filename ? `/api/media/file/${filename}` : null
}

function sameSiteOrigins() {
  return [
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.COOLIFY_URL,
  ]
    .map((value) => {
      if (!value) return null
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export function normalizeMediaUrl(url: string | null | undefined) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (sameSiteOrigins().includes(parsed.origin)) {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    return url
  }

  return url
}

function stringField(media: PayloadMediaRef, key: string) {
  const value = (media as unknown as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

export function getMediaUrl(
  media: PayloadMediaRef | string | number | null | undefined,
  preferredSizes: MediaSizeName[] = ["card", "full", "thumbnail"]
) {
  if (!media) return null
  if (typeof media === "string") return normalizeMediaUrl(media)
  if (typeof media === "number") return null

  for (const size of preferredSizes) {
    const nested = media.sizes?.[size]
    const nestedUrl = normalizeMediaUrl(nested?.url)
    if (nestedUrl) return nestedUrl

    const nestedFilename = fileUrl(nested?.filename)
    if (nestedFilename) return nestedFilename

    const flatUrl = normalizeMediaUrl(stringField(media, `sizes_${size}_url`))
    if (flatUrl) return flatUrl

    const flatFilename = fileUrl(stringField(media, `sizes_${size}_filename`))
    if (flatFilename) return flatFilename
  }

  return normalizeMediaUrl(media.url) || fileUrl(media.filename)
}
