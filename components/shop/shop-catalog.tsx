"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { Check, Coffee, Plus, Search, ShoppingBag, SlidersHorizontal } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { ShopHeader } from "@/components/shop/shop-header"
import { formatPrice } from "@/lib/utils/format"
import type { Product, ProductTypeOption, ProductVariant } from "@/types"

interface ShopCatalogProps {
  productTypes: ProductTypeOption[]
  products: Product[]
}

function ShopProductCard({ product }: { product: Product }) {
  const variants = product.variants || []
  const [variant, setVariant] = useState<ProductVariant | null>(variants[0] || null)
  const [added, setAdded] = useState(false)
  const { addItem } = useGuestCart()

  function addToCart() {
    if (!variant) return
    addItem({ productId: product.id, variantId: variant.id, quantity: 1 })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_18px_60px_rgba(45,27,17,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(91,50,138,0.13)]">
      <Link href={`/shop/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#faead5]">
        {product.images[0] ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-cover transition duration-700 group-hover:scale-[1.04]" sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw" />
        ) : (
          <div className="flex h-full items-center justify-center"><Coffee className="h-16 w-16 text-[#e6610d]/30" /></div>
        )}
        {product.stickers.length > 0 && (
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {product.stickers.slice(0, 2).map((sticker) => <span key={sticker.id} className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#2d1b11] shadow-sm backdrop-blur">{sticker.name}</span>)}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e6610d]">{product.product_type_name}</p>
        <h2 className="mt-1 text-xl font-black tracking-tight text-[#1d1d1b]"><Link href={`/shop/${product.slug}`} className="transition hover:text-[#5b328a]">{product.name}</Link></h2>
        {(product.region || product.processing_method) && <p className="mt-2 text-sm leading-6 text-[#766d66]">{[product.region, product.processing_method].filter(Boolean).join(" · ")}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          {variants.map((item) => (
            <button key={item.id} type="button" onClick={() => setVariant(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${variant?.id === item.id ? "bg-[#5b328a] text-white" : "bg-[#f5f1ed] text-[#625950] hover:bg-[#ece3dc]"}`}>
              {item.name}
            </button>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          <span className="text-2xl font-black tracking-tight text-[#1d1d1b]">{variant ? formatPrice(variant.price) : "—"}</span>
          <button type="button" onClick={addToCart} disabled={!variant} className="flex h-12 items-center gap-2 rounded-full bg-[#5b328a] px-5 text-sm font-bold text-white transition hover:bg-[#47256e] disabled:opacity-40">
            {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}{added ? "Добавлено" : "В корзину"}
          </button>
        </div>
      </div>
    </article>
  )
}

export function ShopCatalog({ productTypes, products }: ShopCatalogProps) {
  const [activeType, setActiveType] = useState(productTypes[0]?.slug || "")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => products.filter((product) => {
    const matchesType = !activeType || product.product_type === activeType
    const haystack = `${product.name} ${product.region || ""} ${product.processing_method || ""}`.toLowerCase()
    return matchesType && haystack.includes(query.trim().toLowerCase())
  }), [activeType, products, query])

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
      <ShopHeader products={products} />

      <section className="mx-auto max-w-[1480px] px-5 pb-10 pt-14 lg:px-10 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#e6610d]">Свежий кофе каждый день</p><h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-7xl">Найдите кофе под свой вкус, а не под сложные термины</h1></div>
          <p className="max-w-md text-base leading-7 text-[#6e655e]">Выберите категорию и фасовку прямо в карточке. Регистрация понадобится только по вашему желанию.</p>
        </div>

        <div className="mt-12 flex flex-col gap-4 rounded-[26px] border border-black/[0.06] bg-white p-3 shadow-sm lg:flex-row lg:items-center">
          <div className="flex flex-1 gap-2 overflow-x-auto p-1">
            {productTypes.map((type) => <button key={type.id} type="button" onClick={() => setActiveType(type.slug)} className={`whitespace-nowrap rounded-full px-5 py-3 text-sm font-bold transition ${activeType === type.slug ? "bg-[#5b328a] text-white" : "text-[#6e655e] hover:bg-[#f5f1ed]"}`}>{type.name} <span className="ml-1 opacity-50">{type.product_count}</span></button>)}
          </div>
          <label className="flex h-12 min-w-0 items-center gap-3 rounded-full bg-[#f5f1ed] px-5 lg:w-[340px]"><Search className="h-4 w-4 text-[#8c8178]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, регион, обработка" className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa098]" /></label>
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 pb-24 lg:px-10">
        <div className="mb-6 flex items-center justify-between"><p className="text-sm font-bold text-[#6e655e]">{filtered.length} товаров</p><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#91867d]"><SlidersHorizontal className="h-4 w-4" /> фильтры будут расширены</span></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((product) => <ShopProductCard key={product.id} product={product} />)}</div>
      </section>
    </main>
  )
}
