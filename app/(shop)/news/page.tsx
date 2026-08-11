import Image from "next/image"
import { Newspaper } from "lucide-react"
import { ShopHeader } from "@/components/shop/shop-header"
import { getNewsPaginated } from "@/lib/actions/news"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"

export const dynamic = "force-dynamic"

function formatDate(value: string | null): string {
  if (!value) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
}

export default async function ShopNewsPage() {
  const [{ items }, products, productTypes] = await Promise.all([
    getNewsPaginated(0, 50),
    getShopProducts(),
    getProductTypes(),
  ])

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
      <ShopHeader products={products} productTypes={productTypes} />
      <section className="mx-auto max-w-[1480px] px-5 py-16 lg:px-10 lg:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e6610d]">10coffee</p>
        <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] sm:text-6xl">Новости</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#6e655e]">События обжарочного производства, новые продукты и важные объявления.</p>

        {items.length === 0 ? (
          <div className="mt-12 flex min-h-72 flex-col items-center justify-center rounded-[32px] border border-dashed border-black/10 bg-white/60 text-center">
            <Newspaper className="h-12 w-12 text-[#e6610d]/35" />
            <p className="mt-4 font-bold">Новости скоро появятся</p>
          </div>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_14px_44px_rgba(45,27,17,0.06)]">
                {item.cover_image && <div className="relative aspect-[16/9] bg-[#faead5]"><Image src={item.cover_image} alt="" fill className="object-cover" sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" /></div>}
                <div className="p-7">
                  {item.published_at && <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e6610d]">{formatDate(item.published_at)}</p>}
                  <h2 className="mt-3 text-2xl font-black leading-tight tracking-[-0.03em]">{item.title}</h2>
                  {item.excerpt && <p className="mt-3 text-sm leading-6 text-[#6e655e]">{item.excerpt}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
