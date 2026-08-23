import { getBlogPosts } from "@/lib/actions/blog"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import Image from "next/image"
import Link from "next/link"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"
import styles from "./blog.module.css"

export const metadata = {
  title: "Блог | 10coffee",
  description: "Статьи о кофе, обжарке, оборудовании и индустрии от команды 10coffee",
}

export const revalidate = 300

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getImageUrl(coverImage: unknown): string | null {
  return getMediaUrl(coverImage as PayloadMediaRef | string | null, ["card", "full", "thumbnail"])
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = parseInt(params.page || "1", 10)
  const { posts, totalPages } = await getBlogPosts(page, 9)

  return (
    <>
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>10КОФЕ</p>
          <h1 className={styles.heroTitle}>Блог</h1>
          <p className={styles.heroSubtitle}>
            Статьи о кофе, обжарке и индустрии
          </p>
        </div>
      </section>

      <section className={styles.posts}>
        {posts.length === 0 ? (
          <div className={styles.empty}>
            <p>Пока нет публикаций</p>
            <p className={styles.emptyHint}>Скоро здесь появятся статьи</p>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {posts.map((post) => {
                const imageUrl = getImageUrl(post.coverImage)
                return (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className={styles.card}
                  >
                    <div className={styles.cardImage}>
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={post.title}
                          fill
                          sizes="(min-width: 1200px) 30vw, (min-width: 700px) 50vw, 100vw"
                          className={styles.cardImg}
                        />
                      ) : (
                        <div className={styles.cardPlaceholder}>
                          <span>10</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.cardBody}>
                      {post.publishedAt ? (
                        <time className={styles.cardDate}>
                          {formatDate(post.publishedAt)}
                        </time>
                      ) : null}
                      <h3 className={styles.cardTitle}>{String(post.title)}</h3>
                      {post.excerpt ? (
                        <p className={styles.cardExcerpt}>{String(post.excerpt)}</p>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/blog?page=${p}`}
                    className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ""}`}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <LandingFooter />
    </>
  )
}
