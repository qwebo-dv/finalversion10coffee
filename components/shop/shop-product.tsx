"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Check, Coffee, Droplets, Leaf, Minus, Paperclip, Plus, ShoppingBag } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { ShopHeader } from "@/components/shop/shop-header"
import { formatPrice, formatWeight } from "@/lib/utils/format"
import type { Product } from "@/types"

const DESCRIPTION_HTML_CLASSNAME = [
  "max-w-none text-[15px] leading-7 text-[#554b43]",
  "[&_p]:mb-4 [&_p:last-child]:mb-0",
  "[&_h1]:mt-7 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:leading-tight [&_h1]:text-[#1d1d1b]",
  "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:leading-tight [&_h2]:text-[#1d1d1b]",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-black [&_h3]:leading-tight [&_h3]:text-[#1d1d1b]",
  "[&_strong]:font-bold [&_strong]:text-[#1d1d1b]",
  "[&_em]:italic",
  "[&_a]:font-semibold [&_a]:text-[#5b328a] [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:mb-1.5",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#5b328a]/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#6e655e]",
  "[&_img]:my-4 [&_img]:rounded-2xl [&_img]:shadow-md",
].join(" ")

export function ShopProduct({ product, products }: { product: Product; products: Product[] }) {
  const variants = product.variants || []
  const [variant, setVariant] = useState(variants[0] || null)
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [added, setAdded] = useState(false)
  const { addItem } = useGuestCart()

  const images = product.images.length > 0 ? product.images : []

  const details = [
    product.roaster ? { label: "Обжарка", value: product.roaster } : null,
    product.region ? { label: "Регион", value: product.region } : null,
    product.processing_method ? { label: "Обработка", value: product.processing_method } : null,
    product.growing_height ? { label: "Высота", value: product.growing_height } : null,
    product.roast_level ? { label: "Обжарка", value: product.roast_level } : null,
    typeof product.q_grader_rating === "number" ? { label: "Q-грейдер", value: String(product.q_grader_rating) } : null,
  ].filter((entry): entry is { label: string; value: string } => entry !== null)

  function addToCart() {
    if (!variant) return
    addItem({ productId: product.id, variantId: variant.id, quantity })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1400)
  }

  const isCoffee = product.product_type_schema === "coffee"
  const isTea = product.product_type_schema === "tea"

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
      <ShopHeader products={products} />

      <div className="mx-auto max-w-[1480px] px-5 pb-24 pt-8 lg:px-10">
        <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-bold text-[#6f655e] transition hover:text-[#5b328a]"><ArrowLeft className="h-4 w-4" /> Вернуться в каталог</Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-12">
          {/* Gallery */}
          <div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] border border-black/[0.06] bg-[#faead5] shadow-[0_24px_80px_rgba(45,27,17,0.1)]">
              {images[imageIndex] ? (
                <Image src={images[imageIndex]} alt={product.name} fill className="object-cover" sizes="(min-width: 1024px) 60vw, 100vw" priority />
              ) : (
                <div className="flex h-full items-center justify-center"><Coffee className="h-24 w-24 text-[#e6610d]/30" /></div>
              )}
              {product.stickers.length > 0 && (
                <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                  {product.stickers.map((sticker) => <span key={sticker.id} className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#2d1b11] shadow-sm backdrop-blur">{sticker.name}</span>)}
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {images.map((image, index) => (
                  <button key={image} type="button" onClick={() => setImageIndex(index)} className={`h-20 w-24 shrink-0 overflow-hidden rounded-2xl border-2 transition ${imageIndex === index ? "border-[#5b328a]" : "border-transparent opacity-70 hover:opacity-100"}`}>
                    <Image src={image} alt={`${product.name} — фото ${index + 1}`} width={96} height={80} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e6610d]">{product.product_type_name}</p>
            <h1 className="mt-3 text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl">{product.name}</h1>

            {details.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {details.map((entry) => (
                  <span key={entry.label} className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#625950] shadow-sm"><span className="text-[#9b9087]">{entry.label}: </span>{entry.value}</span>
                ))}
              </div>
            )}

            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#91867d]">Фасовка</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variants.map((item) => (
                  <button key={item.id} type="button" onClick={() => { setVariant(item); setQuantity(1) }} className={`rounded-2xl border px-5 py-3 text-sm font-bold transition ${variant?.id === item.id ? "border-[#5b328a] bg-[#5b328a] text-white" : "border-black/10 bg-white text-[#625950] hover:border-[#5b328a]/40"}`}>
                    {item.name}{item.weight_grams ? ` · ${formatWeight(item.weight_grams)}` : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#91867d]">Количество</p>
                <div className="mt-3 flex items-center rounded-full bg-white p-1 shadow-sm">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-10 w-10 rounded-full text-[#6f655e] transition hover:bg-[#f5f1ed]"><Minus className="mx-auto h-4 w-4" /></button>
                  <span className="w-10 text-center text-sm font-black">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="h-10 w-10 rounded-full text-[#6f655e] transition hover:bg-[#f5f1ed]"><Plus className="mx-auto h-4 w-4" /></button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#91867d]">Цена</p>
                <p className="mt-1 text-4xl font-black tracking-tight">{variant ? formatPrice(variant.price) : "—"}</p>
              </div>
            </div>

            <button type="button" onClick={addToCart} disabled={!variant} className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#5b328a] text-sm font-black text-white transition hover:bg-[#47256e] disabled:opacity-40">
              {added ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}{added ? "Добавлено в корзину" : `Добавить в корзину · ${variant ? formatPrice(variant.price * quantity) : "—"}`}
            </button>

            {product.description && (
              <div className="mt-10 rounded-[28px] bg-white p-6 shadow-[0_16px_50px_rgba(45,27,17,0.06)] sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e6610d]">Описание</p>
                <div className={DESCRIPTION_HTML_CLASSNAME} dangerouslySetInnerHTML={{ __html: product.description }} />
              </div>
            )}
          </div>
        </div>

        {/* Brewing methods (coffee) */}
        {isCoffee && product.brewing_methods && product.brewing_methods.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faead5]"><Coffee className="h-5 w-5 text-[#5b328a]" /></div>
              <h2 className="text-2xl font-black tracking-tight">Способы приготовления</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {product.brewing_methods.map((method, index) => (
                <div key={index} className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_16px_50px_rgba(45,27,17,0.05)]">
                  {method.image_url && <div className="relative aspect-video bg-[#faead5]"><Image src={method.image_url} alt={method.method} fill className="object-cover" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" /></div>}
                  <div className="p-5">
                    <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#faead5]/60"><Droplets className="h-3.5 w-3.5 text-[#5b328a]" /></div><h4 className="font-bold">{method.method}</h4></div>
                    <p className="mt-2 text-sm leading-6 text-[#6e655e]">{method.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Brewing instructions (tea) */}
        {isTea && product.brewing_instructions && product.brewing_instructions.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faead5]"><Leaf className="h-5 w-5 text-[#5b328a]" /></div>
              <h2 className="text-2xl font-black tracking-tight">Как заваривать</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {product.brewing_instructions.map((instruction, index) => (
                <div key={index} className="flex gap-4 rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_50px_rgba(45,27,17,0.05)]">
                  {instruction.image_url && <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#faead5]"><Image src={instruction.image_url} alt={instruction.title} fill className="object-cover" sizes="80px" /></div>}
                  <div><h4 className="font-bold">{instruction.title}</h4><p className="mt-1.5 text-sm leading-6 text-[#6e655e]">{instruction.text}</p></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Attached files */}
        {product.attached_files && product.attached_files.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-black tracking-tight">Документы и файлы</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {product.attached_files.map((file) => (
                <a key={file.name} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#5b328a] shadow-sm transition hover:shadow-md">
                  <Paperclip className="h-4 w-4" /> {file.name}{file.size ? <span className="text-xs font-semibold text-[#9b9087]">{(file.size / 1024).toFixed(0)} КБ</span> : null}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
