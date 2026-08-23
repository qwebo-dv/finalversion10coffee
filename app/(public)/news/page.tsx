import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import { getNewsPaginated } from "@/lib/actions/news"
import styles from "../blog/blog.module.css"

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

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>10КОФЕ</p>
          <h1 className={styles.heroTitle}>Новости</h1>
          <p className={styles.heroSubtitle}>События обжарочного производства, новые продукты и важные объявления</p>
        </div>
      </section>

      <section className={styles.posts}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <p>Пока нет новостей</p>
            <p className={styles.emptyHint}>Скоро здесь появятся публикации</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <Link key={item.id} href={`/news/${item.slug}`} className={styles.card}>
                <div className={styles.cardImage}>
                  {item.cover_image ? (
                    <Image
                      src={item.cover_image}
                      alt={item.title}
                      fill
                      sizes="(min-width: 1200px) 30vw, (min-width: 700px) 50vw, 100vw"
                      className={styles.cardImg}
                    />
                  ) : (
                    <div className={styles.cardPlaceholder}><span>10</span></div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  {item.published_at && <time className={styles.cardDate}>{formatDate(item.published_at)}</time>}
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  {item.excerpt && <p className={styles.cardExcerpt}>{item.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <LandingFooter />
    </>
  )
}
