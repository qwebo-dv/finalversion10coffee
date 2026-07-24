import { getBlogPost } from "@/lib/actions/blog"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"
import styles from "./article.module.css"

interface Props {
  params: Promise<{ slug: string }>
}

function getImageUrl(coverImage: unknown): string | null {
  return getMediaUrl(coverImage as PayloadMediaRef | string | null, ["full", "card", "thumbnail"])
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

interface LexicalNode {
  type: string
  children?: LexicalNode[]
  text?: string
  format?: number
  tag?: string
  listType?: string
  url?: string
  src?: string
  altText?: string
  value?: {
    url?: string
    filename?: string
    alt?: string
    sizes?: PayloadMediaRef["sizes"]
  }
}

function renderLexicalNode(node: LexicalNode, i: number): React.ReactNode {
  if (node.text !== undefined) {
    let el: React.ReactNode = node.text
    const f = node.format || 0
    if (f & 1) el = <strong key={i}>{el}</strong>
    if (f & 2) el = <em key={i}>{el}</em>
    if (f & 8) el = <u key={i}>{el}</u>
    if (f & 4) el = <s key={i}>{el}</s>
    if (f & 16) el = <code key={i}>{el}</code>
    return el
  }

  if (node.type === "linebreak") return <br key={i} />

  const children = node.children?.map((child, ci) => renderLexicalNode(child, ci))

  switch (node.type) {
    case "paragraph":
      return <p key={i}>{node.children && node.children.length > 0 ? children : <br />}</p>
    case "heading": {
      const tag = node.tag || "h3"
      if (tag === "h1") return <h1 key={i}>{children}</h1>
      if (tag === "h2") return <h2 key={i}>{children}</h2>
      if (tag === "h4") return <h4 key={i}>{children}</h4>
      if (tag === "h5") return <h5 key={i}>{children}</h5>
      if (tag === "h6") return <h6 key={i}>{children}</h6>
      return <h3 key={i}>{children}</h3>
    }
    case "list":
      return node.listType === "number" ? (
        <ol key={i}>{children}</ol>
      ) : (
        <ul key={i}>{children}</ul>
      )
    case "listitem":
      return <li key={i}>{children}</li>
    case "link":
      return (
        <a key={i} href={node.url} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    case "upload": {
      const val = node.value
      const uploadSrc = node.src || getMediaUrl(val as PayloadMediaRef | null, ["full", "card", "thumbnail"])
      return uploadSrc ? (
        <figure key={i} className={styles.contentImage}>
          <Image
            src={uploadSrc}
            alt={node.altText || val?.alt || ""}
            width={1200}
            height={800}
            sizes="(min-width: 900px) 800px, 100vw"
          />
        </figure>
      ) : null
    }
    case "quote":
      return <blockquote key={i}>{children}</blockquote>
    case "horizontalrule":
      return <hr key={i} />
    default:
      return children ? <div key={i}>{children}</div> : null
  }
}

function renderContent(content: unknown) {
  if (!content) return null

  // Lexical JSON object (Payload v3 richText)
  if (typeof content === "object" && content !== null) {
    const root = (content as { root?: LexicalNode }).root
    if (root?.children) {
      return (
        <div className={styles.prose}>
          {root.children.map((node, i) => renderLexicalNode(node, i))}
        </div>
      )
    }
  }

  // String content (legacy or plain text)
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content)
      if (parsed?.root?.children) {
        return (
          <div className={styles.prose}>
            {parsed.root.children.map((node: LexicalNode, i: number) =>
              renderLexicalNode(node, i)
            )}
          </div>
        )
      }
    } catch {
      // Plain text
    }
    return <div className={styles.prose}><p>{content}</p></div>
  }

  return null
}

export const revalidate = 300

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) notFound()

  const imageUrl = getImageUrl(post.coverImage)

  return (
    <>
      <SiteHeader />

      <article>
        <header
          className={styles.hero}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.heroImage}
            />
          )}
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            {post.publishedAt && (
              <time className={styles.heroDate}>
                {formatDate(post.publishedAt as string)}
              </time>
            )}
            <h1 className={styles.heroTitle}>{post.title as string}</h1>
            {post.excerpt && (
              <p className={styles.heroExcerpt}>{post.excerpt as string}</p>
            )}
          </div>
        </header>

        <div className={styles.body}>
          <Link href="/blog" className={styles.back}>
            &larr; Все статьи
          </Link>

          {renderContent(post.content)}
        </div>
      </article>

      <LandingFooter />
    </>
  )
}
