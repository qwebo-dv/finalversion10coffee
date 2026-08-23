import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Newspaper } from "lucide-react"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import { getNewsPaginated } from "@/lib/actions/news"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Новости — 10coffee",
  description: "События обжарочного производства, новые продукты и важные объявления 10coffee.",
  alternates: { canonical: "https://10coffee.ru/news" },
}

function formatDate(value: string | null): string {
  if (!value) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
}

export default async function NewsPage() {
  const { items } = await getNewsPaginated(0, 50)

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
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
                <Link key={item.id} href={`/news/${item.slug}`} className="group overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_14px_44px_rgba(45,27,17,0.06)] transition hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(45,27,17,0.12)]">
                  {item.cover_image && <div className="relative aspect-[16/9] bg-[#faead5]"><Image src={item.cover_image} alt="" fill className="object-cover transition duration-500 group-hover:scale-[1.03]" sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" /></div>}
                  <div className="p-7">
                    {item.published_at && <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e6610d]">{formatDate(item.published_at)}</p>}
                    <h2 className="mt-3 text-2xl font-black leading-tight tracking-[-0.03em] transition group-hover:text-[#5b328a]">{item.title}</h2>
                    {item.excerpt && <p className="mt-3 text-sm leading-6 text-[#6e655e]">{item.excerpt}</p>}
                    <span className="mt-5 inline-block text-sm font-black text-[#5b328a]">Читать новость →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <LandingFooter />
    </>
  )
}
