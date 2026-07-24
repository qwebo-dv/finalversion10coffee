"use client"

import { useState } from "react"
import { getBlogPostsPaginated } from "@/lib/actions/blog"
import { formatDate } from "@/lib/utils/format"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { BlogPost } from "@/types"

const PAGE_SIZE = 10

interface BlogLoadMoreProps {
  initialItems: BlogPost[]
  total: number
}

export function BlogLoadMore({ initialItems, total }: BlogLoadMoreProps) {
  const [items, setItems] = useState<BlogPost[]>(initialItems)
  const [loading, setLoading] = useState(false)

  const hasMore = items.length < total

  async function loadMore() {
    setLoading(true)
    const { items: newItems } = await getBlogPostsPaginated(items.length, PAGE_SIZE)
    setItems((prev) => [...prev, ...(newItems as unknown as BlogPost[])])
    setLoading(false)
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/dashboard/blog/${item.id}`}
            className="flex gap-4 bg-white rounded-xl border border-black/[0.04] p-4 hover:shadow-sm transition-all group"
          >
            {item.coverImage && (
              <div className="relative h-20 w-24 rounded-lg bg-neutral-100 shrink-0 overflow-hidden">
                <Image
                  src={item.coverImage}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-neutral-900 line-clamp-2 group-hover:text-[#5b328a] transition-colors">
                {item.title}
              </p>
              {item.excerpt && (
                <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.excerpt}
                </p>
              )}
              {item.publishedAt && (
                <p className="text-[10px] text-neutral-300 mt-1.5">
                  {formatDate(item.publishedAt)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white border border-black/[0.06] text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 hover:shadow-sm transition-all disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Показать ещё
          </button>
        </div>
      )}
    </>
  )
}
