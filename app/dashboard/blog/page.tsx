import { getBlogPostsPaginated } from "@/lib/actions/blog"
import { BlogLoadMore } from "@/components/dashboard/blog-load-more"
import { BookOpen } from "lucide-react"
import type { BlogPost } from "@/types"

export const dynamic = "force-dynamic"

export default async function BlogPage() {
  const { items, total } = await getBlogPostsPaginated(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-black text-neutral-900 tracking-tight">Блог</h1>
        <p className="text-[12px] text-neutral-400 mt-1">
          Статьи и публикации
        </p>
      </div>

      {!items || items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <BookOpen className="h-7 w-7 text-neutral-300" />
          </div>
          <p className="text-[14px] font-bold text-neutral-900">Пока нет статей</p>
          <p className="text-[12px] text-neutral-400 mt-1">
            Статьи блога появятся здесь
          </p>
        </div>
      ) : (
        <BlogLoadMore initialItems={items as unknown as BlogPost[]} total={total} />
      )}
    </div>
  )
}
