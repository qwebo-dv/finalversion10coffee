import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import { getNewsBySlug } from "@/lib/actions/news"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"
import styles from "../../blog/[slug]/article.module.css"

type PageProps = { params: Promise<{ slug: string }> }

type LexicalNode = {
  type?: string
  children?: LexicalNode[]
  text?: string
  format?: number
  tag?: string
  listType?: string
  fields?: { url?: string; newTab?: boolean }
  value?: PayloadMediaRef & { alt?: string }
  src?: string
  altText?: string
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : ""
}

function renderNode(node: LexicalNode, key: number): React.ReactNode {
  if (node.text !== undefined) {
    let content: React.ReactNode = node.text
    const format = node.format || 0
    if (format & 1) content = <strong>{content}</strong>
    if (format & 2) content = <em>{content}</em>
    if (format & 8) content = <u>{content}</u>
    if (format & 4) content = <s>{content}</s>
    if (format & 16) content = <code>{content}</code>
    return <span key={key}>{content}</span>
  }

  const children = node.children?.map((child, index) => renderNode(child, index))
  if (node.type === "linebreak") return <br key={key} />
  if (node.type === "paragraph") return <p key={key}>{node.children && node.children.length > 0 ? children : <br />}</p>
  if (node.type === "heading") {
    if (node.tag === "h1") return <h1 key={key}>{children}</h1>
    if (node.tag === "h2") return <h2 key={key}>{children}</h2>
    if (node.tag === "h4") return <h4 key={key}>{children}</h4>
    if (node.tag === "h5") return <h5 key={key}>{children}</h5>
    if (node.tag === "h6") return <h6 key={key}>{children}</h6>
    return <h3 key={key}>{children}</h3>
  }
  if (node.type === "list") return node.listType === "number"
    ? <ol key={key}>{children}</ol>
    : <ul key={key}>{children}</ul>
  if (node.type === "listitem") return <li key={key}>{children}</li>
  if (node.type === "link") return <a key={key} href={node.fields?.url} target={node.fields?.newTab ? "_blank" : undefined} rel={node.fields?.newTab ? "noopener noreferrer" : undefined}>{children}</a>
  if (node.type === "quote") return <blockquote key={key}>{children}</blockquote>
  if (node.type === "horizontalrule") return <hr key={key} />
  if (node.type === "upload") {
    const src = node.src || getMediaUrl(node.value || null, ["full", "card", "thumbnail"])
    return src ? (
      <figure key={key} className={styles.contentImage}>
        <Image src={src} alt={node.altText || node.value?.alt || ""} width={1200} height={800} sizes="(min-width: 900px) 800px, 100vw" />
      </figure>
    ) : null
  }
  return children ? <div key={key}>{children}</div> : null
}

function renderContent(content: unknown) {
  let value = content
  if (typeof value === "string") {
    try { value = JSON.parse(value) } catch { return <div className={styles.prose}><p>{String(value)}</p></div> }
  }
  const root = value && typeof value === "object" ? (value as { root?: LexicalNode }).root : null
  return root?.children ? <div className={styles.prose}>{root.children.map((node, index) => renderNode(node, index))}</div> : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const item = await getNewsBySlug(slug)
  if (!item) return { title: "Новость не найдена — 10coffee" }
  return {
    title: `${item.title} — 10coffee`,
    description: item.excerpt || undefined,
    alternates: { canonical: `https://10coffee.ru/news/${item.slug}` },
    openGraph: { title: item.title, description: item.excerpt || undefined, images: item.cover_image ? [item.cover_image] : undefined },
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params
  const item = await getNewsBySlug(slug)
  if (!item) notFound()

  return (
    <>
      <SiteHeader />

      <article>
        <header className={styles.hero}>
          {item.cover_image && <Image src={item.cover_image} alt="" fill priority sizes="100vw" className={styles.heroImage} />}
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            {item.published_at && <time className={styles.heroDate}>{formatDate(item.published_at)}</time>}
            <h1 className={styles.heroTitle}>{item.title}</h1>
            {item.excerpt && <p className={styles.heroExcerpt}>{item.excerpt}</p>}
          </div>
        </header>

        <div className={styles.body}>
          <Link href="/news" className={styles.back}>← Все новости</Link>
          {renderContent(item.content as unknown)}
        </div>
      </article>
      <LandingFooter />
    </>
  )
}
