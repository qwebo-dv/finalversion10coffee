import type { Metadata } from "next"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import { LoyaltyProgramDescription } from "@/components/shop/loyalty-program-description"
import { getPublicLoyalty } from "@/lib/actions/loyalty"
import blogStyles from "../blog/blog.module.css"
import articleStyles from "../blog/[slug]/article.module.css"

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

      <section className={blogStyles.hero}>
        <div className={blogStyles.heroContent}>
          <p className={blogStyles.heroLabel}>ПОКУПАТЕЛЯМ</p>
          <h1 className={blogStyles.heroTitle}>Бонусная программа</h1>
          <p className={blogStyles.heroSubtitle}>Получайте баллы за доставленные розничные заказы и используйте их для оплаты кофе</p>
        </div>
      </section>

      <section className={articleStyles.body}>
        <LoyaltyProgramDescription rules={rules} />
      </section>
      <LandingFooter />
    </>
  )
}
