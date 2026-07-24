import { getBlogPostById } from "@/lib/actions/blog"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/utils/format"
import { ArrowLeft } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
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
    if (f & 16) el = <code key={i} className="rounded bg-neutral-100 px-1 py-0.5 text-sm">{el}</code>
    return el
  }

  if (node.type === "linebreak") return <br key={i} />

  const children = node.children?.map((child, ci) => renderLexicalNode(child, ci))

  switch (node.type) {
    case "paragraph":
      return <p key={i}>{node.children && node.children.length > 0 ? children : <br />}</p>
    case "heading": {
      const tag = node.tag || "h3"
      if (tag === "h1") return <h1 key={i} className="text-2xl font-bold">{children}</h1>
      if (tag === "h2") return <h2 key={i} className="text-xl font-bold">{children}</h2>
      if (tag === "h4") return <h4 key={i} className="text-base font-bold">{children}</h4>
      if (tag === "h5") return <h5 key={i} className="text-sm font-bold">{children}</h5>
      if (tag === "h6") return <h6 key={i} className="text-sm font-semibold">{children}</h6>
      return <h3 key={i} className="text-lg font-bold">{children}</h3>
    }
    case "list":
      return node.listType === "number" ? (
        <ol key={i} className="list-decimal pl-5 space-y-1">{children}</ol>
      ) : (
        <ul key={i} className="list-disc pl-5 space-y-1">{children}</ul>
      )
    case "listitem":
      return <li key={i}>{children}</li>
    case "link":
      return (
        <a key={i} href={node.url} target="_blank" rel="noopener noreferrer" className="text-[#5b328a] underline">
          {children}
        </a>
      )
    case "upload": {
      const val = node.value
      const uploadSrc = node.src || val?.url || (val?.filename ? `/api/media/file/${val.filename}` : null)
      return uploadSrc ? (
        <figure key={i} className="my-4">
          <Image
            src={uploadSrc}
            alt={node.altText || val?.alt || ""}
            width={1200}
            height={800}
            sizes="(min-width: 900px) 768px, 100vw"
            className="rounded-lg h-auto w-full"
          />
        </figure>
      ) : null
    }
    case "quote":
      return <blockquote key={i} className="border-l-2 border-neutral-300 pl-4 italic text-neutral-500">{children}</blockquote>
    case "horizontalrule":
      return <hr key={i} className="my-6 border-neutral-200" />
    default:
      return children ? <div key={i}>{children}</div> : null
  }
}

function renderContent(content: unknown) {
  if (!content) return null

  if (typeof content === "object" && content !== null) {
    const root = (content as { root?: LexicalNode }).root
    if (root?.children) {
      return (
        <div className="space-y-4">
          {root.children.map((node, i) => renderLexicalNode(node, i))}
        </div>
      )
    }
  }

  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content)
      if (parsed?.root?.children) {
        return (
          <div className="space-y-4">
            {parsed.root.children.map((node: LexicalNode, i: number) =>
              renderLexicalNode(node, i)
            )}
          </div>
        )
      }
    } catch {
      // Plain text
    }
    return <p className="whitespace-pre-wrap">{content}</p>
  }

  return null
}

export default async function BlogDetailPage({ params }: Props) {
  const { id } = await params
  const post = await getBlogPostById(id)

  if (!post) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/blog"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-neutral-400 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Назад к блогу
      </Link>

      {post.coverImage && (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-100">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            priority
            sizes="(min-width: 900px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <div>
        <h1 className="text-[28px] font-black text-neutral-900 tracking-tight">
          {post.title}
        </h1>
        {post.publishedAt && (
          <p className="text-[12px] text-neutral-400 mt-2">
            {formatDate(post.publishedAt)}
          </p>
        )}
      </div>

      <div className="text-[14px] text-neutral-700 leading-relaxed">
        {renderContent(post.content)}
      </div>
    </div>
  )
}
