const STORAGE_KEY = "10coffee-recently-viewed-v1"
const MAX_ITEMS = 30

export interface RecentlyViewedEntry {
  productId: string
  slug: string
  viewedAt: string
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is RecentlyViewedEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.productId === "string" &&
        typeof entry.slug === "string"
    )
  } catch {
    return []
  }
}

export function addRecentlyViewed(productId: string, slug: string): void {
  if (typeof window === "undefined") return
  try {
    const entries = getRecentlyViewed().filter((entry) => entry.productId !== productId)
    entries.unshift({ productId, slug, viewedAt: new Date().toISOString() })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)))
  } catch {
    // localStorage may be unavailable (private mode) — ignore
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
