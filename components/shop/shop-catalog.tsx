"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Check, ChevronDown, Coffee, Droplets, LayoutGrid, Leaf, Search, ShoppingBag, SlidersHorizontal, Sparkles, Star, Sun, TrendingUp, Waves, X } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { ShopHeader } from "@/components/shop/shop-header"
import { CoffeeAcidity } from "@/components/shop/coffee-acidity"
import { formatPrice, formatWeight } from "@/lib/utils/format"
import { COFFEE_GROUPS, getCoffeeGroup } from "@/lib/coffee-groups"
import { findVariantForSelection, getGrindOptions, getVariantGrindOption, getVariantWeights, GRIND_OPTION_LABELS } from "@/lib/shop-variant-options"
import type { Product, ProductTypeOption, ProductVariant } from "@/types"

interface ShopCatalogProps {
  productTypes: ProductTypeOption[]
  products: Product[]
  initialType?: string
}

type SortKey = "default" | "price-asc" | "price-desc" | "rating" | "new"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "По умолчанию" },
  { value: "rating", label: "Сначала популярные" },
  { value: "price-asc", label: "Сначала дешевле" },
  { value: "price-desc", label: "Сначала дороже" },
]

interface CollectionPreset {
  id: string
  label: string
  icon: LucideIcon
  type?: string
  roast?: string[]
  processingContains?: string[]
  brewGroup?: "espresso" | "filter" | "drip"
  sort?: SortKey
  reset?: boolean
}

const COLLECTIONS: CollectionPreset[] = [
  { id: "all", label: "Все товары", icon: LayoutGrid, reset: true },
  { id: "popular", label: "Популярное", icon: TrendingUp, sort: "rating" },
  { id: "new", label: "Новинки", icon: Sparkles, sort: "new" },
  { id: "espresso", label: "Для эспрессо", icon: Coffee, type: "kofe", brewGroup: "espresso" },
  { id: "filter", label: "Для фильтра", icon: Droplets, type: "kofe", brewGroup: "filter" },
  { id: "drip", label: "Дрип-кофе", icon: Droplets, type: "kofe", brewGroup: "drip" },
  { id: "natural", label: "Натуральная обработка", icon: Sun, processingContains: ["натуральн"] },
  { id: "washed", label: "Мытая обработка", icon: Waves, processingContains: ["мыт"] },
  { id: "tea", label: "Чай", icon: Leaf, type: "chay" },
]

function FilterDropdown({ label, options, selected, onToggle, onClear }: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={() => setOpen((value) => !value)} className={`flex h-12 items-center gap-2 whitespace-nowrap rounded-full border px-5 text-sm font-bold transition ${open ? "border-[#5b328a] bg-[#5b328a]/[0.06] text-[#5b328a]" : "border-black/[0.1] bg-white text-[#554b43] hover:border-black/25"}`}>
        {label}
        {selected.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e6610d] px-1.5 text-[10px] font-black text-white">{selected.length}</span>}
        <ChevronDown className={`h-4 w-4 opacity-50 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-2 shadow-[0_24px_70px_rgba(45,27,17,0.16)]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[#91867d]">{label}</span>
            {selected.length > 0 && <button type="button" onClick={onClear} className="text-xs font-bold text-[#e6610d] hover:underline">Сбросить</button>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {options.length === 0 ? <p className="px-3 py-4 text-sm text-[#aaa098]">Нет значений</p> : options.map((option) => {
              const checked = selected.includes(option)
              return (
                <button key={option} type="button" onClick={() => onToggle(option)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#f5f1ed]">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${checked ? "border-[#5b328a] bg-[#5b328a]" : "border-black/15"}`}>{checked && <Check className="h-3.5 w-3.5 text-white" />}</span>
                  <span className={`truncate font-semibold ${checked ? "text-[#5b328a]" : "text-[#1d1d1b]"}`}>{option}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ShopProductCard({ product }: { product: Product }) {
  const variants = (product.variants || []).filter((item) => item.is_available)
  const [variant, setVariant] = useState<ProductVariant | null>(variants[0] || null)
  const { items, addItem } = useGuestCart()
  const inCart = items.some((item) => item.productId === product.id && item.variantId === variant?.id)
  const weights = getVariantWeights(variants)
  const selectedWeight = variant?.weight_grams || weights[0] || null
  const selectedGrind = getVariantGrindOption(variant)
  const grindOptions = getGrindOptions(variants, selectedWeight)
  const hasStructuredCoffeeOptions = product.product_type_schema === "coffee" && weights.length > 0 && grindOptions.length > 0

  function addToCart() {
    if (!variant) return
    addItem({ productId: product.id, variantId: variant.id, quantity: 1 })
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-black/[0.05] bg-white shadow-[0_12px_36px_rgba(45,27,17,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(91,50,138,0.1)]">
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e6610d]">{product.product_type_name}</p>
          {typeof product.rating === "number" && product.rating > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#625950]">
              <Star className="h-3.5 w-3.5 fill-[#f2a515] text-[#f2a515]" />
              {product.rating.toFixed(1)}
              {!!product.reviews_count && <span className="font-medium text-[#aaa097]">({product.reviews_count})</span>}
            </span>
          )}
        </div>
        <h2 className="mt-1.5 text-xl font-black leading-tight tracking-tight text-[#1d1d1b]"><Link href={`/shop/${product.slug}`} className="transition hover:text-[#5b328a]">{product.name}</Link></h2>
        {(product.region || product.processing_method) && <p className="mt-2 text-xs leading-5 text-[#91867d]">{[product.region, product.processing_method].filter(Boolean).join(" · ")}</p>}
        {product.product_type_schema === "coffee" && product.taste_description && (
          <p className="mt-3 line-clamp-2 text-sm leading-5 text-[#554b43]">{product.taste_description}</p>
        )}
        {product.product_type_schema === "coffee" && product.acidity && (
          <div className="mt-3"><CoffeeAcidity value={product.acidity} compact /></div>
        )}

        {hasStructuredCoffeeOptions ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa097]">Вес</p>
              <div className="flex flex-wrap gap-1.5">
                {weights.map((weight) => (
                  <button
                    key={weight}
                    type="button"
                    onClick={() => setVariant(findVariantForSelection(variants, weight, selectedGrind))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedWeight === weight ? "bg-[#5b328a] text-white" : "bg-[#f5f1ed] text-[#625950] hover:bg-[#ece5df] hover:text-[#5b328a]"}`}
                  >
                    {formatWeight(weight)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa097]">Формат</p>
              <div className="flex flex-wrap gap-1.5">
                {grindOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVariant(findVariantForSelection(variants, selectedWeight, option))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${selectedGrind === option ? "bg-[#1d1d1b] text-white" : "bg-[#f5f1ed] text-[#625950] hover:bg-[#ece5df] hover:text-[#1d1d1b]"}`}
                  >
                    {GRIND_OPTION_LABELS[option] || option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : variants.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#9b9087]">Вариант</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((item) => (
                <button key={item.id} type="button" onClick={() => setVariant(item)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${variant?.id === item.id ? "bg-[#5b328a] text-white" : "bg-[#f5f1ed] text-[#625950] hover:bg-[#ece3dc]"}`}>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-4 pt-5 mt-5">
          <span className="text-[22px] font-black tracking-tight text-[#1d1d1b]">{variant ? formatPrice(variant.price) : "—"}</span>
          <button type="button" onClick={addToCart} disabled={!variant} className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-md transition disabled:opacity-40 ${inCart ? "bg-[#e6610d] shadow-[#e6610d]/20 hover:bg-[#cf5206]" : "bg-[#1d1d1b] shadow-black/10 hover:bg-black"}`}>
            {inCart ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}{inCart ? "В корзине" : "В корзину"}
          </button>
        </div>
      </div>
    </article>
  )
}

function matchesSelection(product: Product, group: "roast" | "region" | "processing", selectedValues: string[]) {
  const field = group === "roast" ? product.roast_level : group === "region" ? product.region : product.processing_method
  return !selectedValues.length || selectedValues.includes(field || "")
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  kofe: "Свежеобжаренный кофе в зёрнах или с бесплатным помолом. Выберите фасовку прямо в карточке товара.",
  chay: "Чай на каждый день и для особых случаев. Выберите сорт и подходящую фасовку.",
  aksessuary: "Всё необходимое для приготовления и подачи любимых напитков.",
  himiya: "Средства для ухода за кофейным оборудованием и поддержания чистоты.",
}

export function ShopCatalog({ productTypes, products, initialType = "" }: ShopCatalogProps) {
  const router = useRouter()
  const [activeType, setActiveType] = useState(initialType)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<{ roast: string[]; region: string[]; processing: string[] }>({ roast: [], region: [], processing: [] })
  const [sort, setSort] = useState<SortKey>("default")
  const [activeCollection, setActiveCollection] = useState("")
  const skipNextSync = useRef(true)

  /* The URL is the external source of truth when a category/filter link is opened. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get("q")
    const coll = params.get("coll")
    const sortParam = params.get("sort") as SortKey | null
    const roast = (params.get("roast") || "").split("|").filter(Boolean)
    const region = (params.get("region") || "").split("|").filter(Boolean)
    const process = (params.get("process") || "").split("|").filter(Boolean)
    setActiveType(initialType && productTypes.some((entry) => entry.slug === initialType) ? initialType : "")
    if (q) setQuery(q)
    if (coll && COLLECTIONS.some((entry) => entry.id === coll)) setActiveCollection(coll)
    if (sortParam && SORT_OPTIONS.some((option) => option.value === sortParam)) setSort(sortParam)
    setSelected({ roast, region, processing: process })
  }, [initialType, productTypes])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false
      return
    }
    const managed = new Set(["type", "q", "coll", "sort", "roast", "region", "process"])
    const existing = new URLSearchParams(window.location.search)
    const params = new URLSearchParams()
    existing.forEach((value, key) => {
      if (!managed.has(key)) params.set(key, value)
    })
    if (query.trim()) params.set("q", query.trim())
    if (activeCollection && activeCollection !== "all") params.set("coll", activeCollection)
    if (sort !== "default") params.set("sort", sort)
    if (selected.roast.length) params.set("roast", selected.roast.join("|"))
    if (selected.region.length) params.set("region", selected.region.join("|"))
    if (selected.processing.length) params.set("process", selected.processing.join("|"))
    const qs = params.toString()
    const url = qs ? `?${qs}` : window.location.pathname
    window.history.replaceState(null, "", url)
  }, [activeCollection, activeType, query, selected, sort])

  const activeCollectionDef = COLLECTIONS.find((collection) => collection.id === activeCollection)

  const basePredicate = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    return (product: Product) => {
      if (activeCollectionDef?.type && product.product_type !== activeCollectionDef.type) return false
      if (activeCollectionDef?.roast?.length && !activeCollectionDef.roast.some((roast) => (product.roast_level || "").toLowerCase().includes(roast))) return false
      if (activeCollectionDef?.processingContains?.length && !activeCollectionDef.processingContains.some((method) => (product.processing_method || "").toLowerCase().includes(method))) return false
      if (activeCollectionDef?.brewGroup && getCoffeeGroup(product) !== activeCollectionDef.brewGroup) return false
      if (activeType && product.product_type !== activeType) return false
      if (lowered) {
        const haystack = `${product.name} ${product.country || ""} ${product.region || ""} ${product.processing_method || ""} ${product.roast_level || ""} ${product.taste_description || ""}`.toLowerCase()
        if (!haystack.includes(lowered)) return false
      }
      return true
    }
  }, [activeCollectionDef, activeType, query])

  const categoryProducts = useMemo(() => products.filter(basePredicate), [products, basePredicate])

  const roastOptions = useMemo(() => {
    const values = Array.from(new Set(categoryProducts
      .filter((p) => matchesSelection(p, "region", selected.region) && matchesSelection(p, "processing", selected.processing))
      .map((p) => p.roast_level).filter((value): value is string => Boolean(value))))
    return Array.from(new Set([...values, ...selected.roast]))
  }, [categoryProducts, selected])

  const regionOptions = useMemo(() => {
    const values = Array.from(new Set(categoryProducts
      .filter((p) => matchesSelection(p, "roast", selected.roast) && matchesSelection(p, "processing", selected.processing))
      .map((p) => p.region).filter((value): value is string => Boolean(value))))
    return Array.from(new Set([...values, ...selected.region]))
  }, [categoryProducts, selected])

  const processingOptions = useMemo(() => {
    const values = Array.from(new Set(categoryProducts
      .filter((p) => matchesSelection(p, "roast", selected.roast) && matchesSelection(p, "region", selected.region))
      .map((p) => p.processing_method).filter((value): value is string => Boolean(value))))
    return Array.from(new Set([...values, ...selected.processing]))
  }, [categoryProducts, selected])

  const hasFilterOptions = roastOptions.length + regionOptions.length + processingOptions.length > 0

  const activeFilters = selected.roast.length + selected.region.length + selected.processing.length

  const effectiveSort: SortKey = activeCollectionDef?.sort || sort

  const filtered = useMemo(() => {
    const matches = categoryProducts.filter((product) => {
      if (selected.roast.length && !selected.roast.includes(product.roast_level || "")) return false
      if (selected.region.length && !selected.region.includes(product.region || "")) return false
      if (selected.processing.length && !selected.processing.includes(product.processing_method || "")) return false
      return true
    })

    const compareCoffeeGroups = (a: Product, b: Product) => activeType === "kofe"
      ? COFFEE_GROUPS.findIndex((group) => group.id === getCoffeeGroup(a)) - COFFEE_GROUPS.findIndex((group) => group.id === getCoffeeGroup(b))
      : 0

    switch (effectiveSort) {
      case "price-asc":
        return [...matches].sort((a, b) => compareCoffeeGroups(a, b) || (a.variants?.[0]?.price || 0) - (b.variants?.[0]?.price || 0))
      case "price-desc":
        return [...matches].sort((a, b) => compareCoffeeGroups(a, b) || (b.variants?.[0]?.price || 0) - (a.variants?.[0]?.price || 0))
      case "rating":
        return [...matches].sort((a, b) => compareCoffeeGroups(a, b) || (b.rating || 0) - (a.rating || 0))
      case "new":
        return [...matches].sort((a, b) => compareCoffeeGroups(a, b) || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      default:
        return [...matches].sort(compareCoffeeGroups)
    }
  }, [activeType, categoryProducts, selected, effectiveSort])

  const showCoffeeGroups = activeType === "kofe" && (!activeCollection || activeCollection === "all")

  function applyCollection(id: string) {
    const collection = COLLECTIONS.find((entry) => entry.id === id)
    if (!collection) return
    if (collection.reset) {
      setQuery("")
      setSelected({ roast: [], region: [], processing: [] })
      setSort("default")
      setActiveCollection("all")
      return
    }
    if (collection.type && collection.type !== activeType) {
      router.push(`/${collection.type}?coll=${collection.id}`)
      return
    }
    setSelected((current) => ({ ...current, roast: [], region: [], processing: [] }))
    setSort(collection.sort || "default")
    setActiveCollection(id)
  }

  function toggleFilter(group: "roast" | "region" | "processing", value: string) {
    setActiveCollection("")
    setSelected((current) => {
      const list = current[group]
      const next = list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
      return { ...current, [group]: next }
    })
  }

  function resetFilters() {
    setActiveCollection("")
    setSelected({ roast: [], region: [], processing: [] })
    setSort("default")
  }

  const activeTypeName = productTypes.find((type) => type.slug === activeType)?.name || "Каталог"
  const categoryDescription = activeType
    ? CATEGORY_DESCRIPTIONS[activeType] || `Товары раздела «${activeTypeName}» с актуальными ценами и наличием.`
    : "Кофе, чай, аксессуары и товары для ухода за оборудованием в одном каталоге."

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
      <ShopHeader products={products} productTypes={productTypes} />

      <section className="mx-auto max-w-[1480px] px-5 pb-8 pt-5 lg:px-10 lg:pt-6">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em]">{activeTypeName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6e655e]">{categoryDescription}</p>
          </div>
          <label className="flex h-12 min-w-0 items-center gap-3 rounded-full bg-white px-5 shadow-sm ring-1 ring-black/[0.06] lg:w-[360px]"><Search className="h-4 w-4 text-[#8c8178]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, регион, обработка" className="w-full bg-transparent text-sm outline-none placeholder:text-[#aaa098]" /></label>
        </div>

      </section>

      <section className="mx-auto max-w-[1480px] px-5 pb-24 lg:px-10">
        <div className="mb-6 flex items-center justify-between"><p className="text-sm font-bold text-[#6e655e]">{filtered.length} {filtered.length === 1 ? "товар" : filtered.length < 5 ? "товара" : "товаров"}</p>{query && <button type="button" onClick={() => setQuery("")} className="flex items-center gap-1.5 text-xs font-bold text-[#91867d] hover:text-[#e6610d]">Сбросить поиск «{query}» <X className="h-3.5 w-3.5" /></button>}</div>
        {filtered.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-black/10 bg-white/60 px-8 py-24 text-center">
            <Coffee className="mx-auto h-12 w-12 text-[#e6610d]/40" />
            <h3 className="mt-5 text-xl font-black">Ничего не нашлось</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8d827a]">Попробуйте изменить запрос или сбросить фильтры.</p>
            <button type="button" onClick={resetFilters} className="mt-6 rounded-full bg-[#5b328a] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#47256e]">Сбросить фильтры</button>
          </div>
        ) : (
          showCoffeeGroups ? (
            <div className="space-y-14">
              {COFFEE_GROUPS.map((group) => {
                const groupProducts = filtered.filter((product) => getCoffeeGroup(product) === group.id)
                if (!groupProducts.length) return null
                return (
                  <section key={group.id}>
                    <div className="mb-6 flex items-baseline gap-3 border-b border-black/[0.08] pb-4">
                      <h2 className="text-3xl font-black tracking-[-0.04em]">{group.label}</h2>
                      <span className="text-sm font-bold text-[#9b9087]">{groupProducts.length}</span>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {groupProducts.map((product) => <ShopProductCard key={product.id} product={product} />)}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((product) => <ShopProductCard key={product.id} product={product} />)}</div>
          )
        )}
      </section>
    </main>
  )
}
