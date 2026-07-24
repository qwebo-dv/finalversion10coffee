import { getNewsPaginated } from "@/lib/actions/news"
import { NewsLoadMore } from "@/components/dashboard/news-load-more"
import { Newspaper } from "lucide-react"
import type { News } from "@/types"

export const dynamic = "force-dynamic"

export default async function NewsPage() {
  const { items, total } = await getNewsPaginated(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-black text-neutral-900 tracking-tight">Новости</h1>
        <p className="text-[12px] text-neutral-400 mt-1">
          Новости и объявления
        </p>
      </div>

      {!items || items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <Newspaper className="h-7 w-7 text-neutral-300" />
          </div>
          <p className="text-[14px] font-bold text-neutral-900">Пока нет новостей</p>
          <p className="text-[12px] text-neutral-400 mt-1">
            Новости и объявления появятся здесь
          </p>
        </div>
      ) : (
        <NewsLoadMore initialItems={items as News[]} total={total} />
      )}
    </div>
  )
}
