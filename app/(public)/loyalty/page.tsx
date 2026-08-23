import type { Metadata } from "next"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import { LoyaltyProgramDescription } from "@/components/shop/loyalty-program-description"
import { getPublicLoyalty } from "@/lib/actions/loyalty"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Бонусная программа — 10coffee",
  description: "Как начисляются, списываются и хранятся бонусные баллы 10coffee.",
  alternates: { canonical: "https://10coffee.ru/loyalty" },
}

export default async function PublicLoyaltyPage() {
  const rules = await getPublicLoyalty()

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#f8f5f1] px-5 py-16 text-[#1d1d1b] lg:px-10 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e6610d]">Покупателям</p>
          <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] sm:text-6xl">Бонусная программа</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#6e655e]">Получайте баллы за доставленные розничные заказы и используйте их для оплаты кофе. Ниже — основные правила без сложных расчётов.</p>
          <div className="mt-10">
            <LoyaltyProgramDescription rules={rules} />
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  )
}
