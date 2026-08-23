import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import SiteHeader from "@/components/landing/SiteHeader"
import LandingFooter from "@/components/landing/LandingFooter"
import { getNewsBySlug } from "@/lib/actions/news"
import { getMediaUrl, type PayloadMediaRef } from "@/lib/media"

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
  if (node.type === "paragraph") return <p key={key} className="my-5 text-base leading-8 text-[#554b43]">{children}</p>
  if (node.type === "heading") {
    if (node.tag === "h2") return <h2 key={key} className="mb-4 mt-10 text-3xl font-black tracking-[-0.03em]">{children}</h2>
    return <h3 key={key} className="mb-3 mt-8 text-2xl font-black tracking-[-0.02em]">{children}</h3>
  }
  if (node.type === "list") return node.listType === "number"
    ? <ol key={key} className="my-5 list-decimal space-y-2 pl-6 text-[#554b43]">{children}</ol>
    : <ul key={key} className="my-5 list-disc space-y-2 pl-6 text-[#554b43]">{children}</ul>
  if (node.type === "listitem") return <li key={key}>{children}</li>
  if (node.type === "link") return <a key={key} href={node.fields?.url} target={node.fields?.newTab ? "_blank" : undefined} rel={node.fields?.newTab ? "noopener noreferrer" : undefined} className="font-bold text-[#5b328a] underline">{children}</a>
  if (node.type === "quote") return <blockquote key={key} className="my-7 border-l-4 border-[#e6610d] pl-6 text-xl font-bold leading-8 text-[#554b43]">{children}</blockquote>
  if (node.type === "horizontalrule") return <hr key={key} className="my-10 border-black/10" />
  if (node.type === "upload") {
    const src = node.src || getMediaUrl(node.value || null, ["full", "card", "thumbnail"])
    return src ? <figure key={key} className="relative my-8 aspect-[16/9] overflow-hidden rounded-[28px] bg-[#faead5]"><Image src={src} alt={node.altText || node.value?.alt || ""} fill className="object-cover" sizes="(min-width: 900px) 900px, 100vw" /></figure> : null
  }
  return children ? <div key={key}>{children}</div> : null
}

function renderContent(content: unknown) {
  let value = content
  if (typeof value === "string") {
    try { value = JSON.parse(value) } catch { return <p className="my-5 whitespace-pre-line text-base leading-8 text-[#554b43]">{String(value)}</p> }
  }
  const root = value && typeof value === "object" ? (value as { root?: LexicalNode }).root : null
  return root?.children?.map((node, index) => renderNode(node, index)) || null
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
      <main className="min-h-screen bg-[#f8f5f1] px-5 py-14 text-[#1d1d1b] lg:px-10 lg:py-20">
        <article className="mx-auto max-w-4xl">
          <Link href="/news" className="text-sm font-black text-[#5b328a]">← Все новости</Link>
          {item.published_at && <p className="mt-10 text-xs font-black uppercase tracking-[0.18em] text-[#e6610d]">{formatDate(item.published_at)}</p>}
          <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-[-0.05em] sm:text-6xl">{item.title}</h1>
          {item.excerpt && <p className="mt-6 text-lg leading-8 text-[#6e655e]">{item.excerpt}</p>}
          {item.cover_image && <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-[32px] bg-[#faead5]"><Image src={item.cover_image} alt="" fill priority className="object-cover" sizes="(min-width: 900px) 900px, 100vw" /></div>}
          <div className="mt-10">{renderContent(item.content as unknown)}</div>
        </article>
      </main>
      <LandingFooter />
    </>
  )
}
