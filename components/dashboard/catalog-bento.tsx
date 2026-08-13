"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Heart,
  Plus,
  Minus,
  ArrowLeft,
  Coffee,
  Leaf,
  Package,
  Star,
  Check,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useCart } from "@/providers/cart-provider"
import { formatPrice } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ProductTableRow } from "./product-table-row"
import type { Product, ProductType, ProductTypeOption } from "@/types"

interface TagOption {
  id: string
  name: string
  slug: string
  color?: string
}

interface CatalogCategory {
  id: number
  name: string
  children?: CatalogCategory[]
  image?: {
    url?: string
    sizes?: {
      card?: { url?: string }
    }
  } | null
}

interface Props {
  categories: CatalogCategory[]
  favoriteIds: string[]
  activeType: ProductType
  productTypes: ProductTypeOption[]
  tags: TagOption[]
}

type ViewMode = "grid" | "list"
type SortMode = "alphabetical" | "price"
type FilterMode = string

const fallbackTypeIcons: Record<string, typeof Coffee> = {
  coffee: Coffee,
  tea: Leaf,
  accessory: Package,
}

const sortLabels: Record<SortMode, string> = {
  alphabetical: "По алфавиту",
  price: "По цене",
}

const cardColors = [
  "bg-[#faead5]",
  "bg-[#faead5]/80",
  "bg-[#faead5]/60",
  "bg-[#faead5]",
  "bg-[#faead5]/80",
  "bg-[#faead5]/60",
  "bg-[#faead5]",
  "bg-[#faead5]/80",
  "bg-[#faead5]/60",
  "bg-[#faead5]",
  "bg-[#faead5]/80",
  "bg-[#faead5]/60",
]

function isSinglePieceVariantName(name: string | undefined) {
  return /^1\s*шт\.?$/i.test((name || "").trim())
}

async function fetchCategoryProducts(categoryId: number | string, signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch(`/api/catalog/products?categoryId=${encodeURIComponent(categoryId)}`, {
    signal,
    cache: "no-store",
  })

  if (!response.ok) throw new Error("Failed to load category products")

  const data = await response.json() as { products?: Product[] }
  return data.products || []
}

export function CatalogBento({ categories, favoriteIds, activeType, productTypes, tags }: Props) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [sortMode, setSortMode] = useState<SortMode>("alphabetical")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedName, setExpandedName] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedListIds, setExpandedListIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!expandedId) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchCategoryProducts(expandedId, controller.signal)
        .then((data) => {
          setProducts(data)
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          console.error(error)
          setProducts([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [expandedId])

  const allCats: CatalogCategory[] = useMemo(() => {
    const result: CatalogCategory[] = []
    categories.forEach((c) => {
      if (c.children?.length) c.children.forEach((s) => result.push(s))
      else result.push(c)
    })
    return result
  }, [categories])

  function toggleListCategory(id: number) {
    setExpandedListIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpandAll() {
    const allExpanded = allCats.every((c) => expandedListIds.has(c.id))
    setExpandedListIds(allExpanded ? new Set() : new Set(allCats.map((c) => c.id)))
  }

  return (
    <div className="space-y-5">
      {/* Type pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pr-4 sm:pr-0">
        <span className="text-[11px] font-bold text-neutral-300 mr-2 tracking-[0.15em] uppercase shrink-0 hidden sm:block">
          Каталог
        </span>
        {productTypes.map((t) => {
          const FallbackIcon = fallbackTypeIcons[t.slug] || Package
          return (
            <button
              key={t.id}
              onClick={() => {
                router.push(`/dashboard/catalog?type=${encodeURIComponent(t.slug)}`)
                setExpandedId(null)
                setExpandedListIds(new Set())
              }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-300",
                activeType === t.slug
                  ? "bg-[#5b328a] text-white shadow-md shadow-[#5b328a]/10"
                  : "bg-white/80 text-neutral-500 hover:text-neutral-900 hover:bg-white hover:shadow-sm"
              )}
            >
              {t.icon_url ? (
                <img
                  src={t.icon_url}
                  alt=""
                  className={cn(
                    "h-3.5 w-3.5 object-contain transition-all duration-300",
                    activeType === t.slug && "brightness-0 invert"
                  )}
                  aria-hidden="true"
                />
              ) : (
                <FallbackIcon className="h-3.5 w-3.5" />
              )}
              {t.name}
            </button>
          )
        })}
      </div>

      {/* Toolbar: view toggle + sort + filter */}
      {!expandedId && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort */}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="text-[12px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg px-3 py-2 outline-none hover:border-neutral-400 transition-colors cursor-pointer"
          >
            {Object.entries(sortLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Filter */}
          {tags.length > 0 && (
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="text-[12px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg px-3 py-2 outline-none hover:border-neutral-400 transition-colors cursor-pointer"
            >
              <option value="all">Показывать все</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.slug}>
                  {tag.name}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleExpandAll}
              className="text-[11px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider mr-3"
            >
              {allCats.every((c) => expandedListIds.has(c.id)) ? "Свернуть все" : "Развернуть все"}
            </button>
          </div>
        </div>
      )}

      {/* ── GRID MODE with expanded category ── */}
      {viewMode === "grid" && expandedId ? (
        <div>
          <button
            onClick={() => setExpandedId(null)}
            className="flex items-center gap-2 text-neutral-400 hover:text-neutral-900 text-sm mb-5 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Назад
          </button>
          <h2 className="text-xl font-black text-neutral-900 mb-5">
            {expandedName}
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-[#faead5] border-t-[#5b328a] animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Coffee className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">Товары скоро появятся</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p, i) => (
                <ProdCard key={p.id} product={p} idx={i} />
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* ── GRID MODE: category cards ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allCats.length === 0 ? (
            <div className="col-span-full flex flex-col items-center py-20">
              <Coffee className="h-10 w-10 text-neutral-200 mb-3" />
              <p className="text-neutral-400 text-sm">Нет категорий</p>
            </div>
          ) : (
            allCats.map((cat, i) => {
              const catImageUrl =
                cat.image?.url || cat.image?.sizes?.card?.url || null
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setExpandedId(cat.id)
                    setExpandedName(cat.name)
                  }}
                  className={cn(
                    "text-left rounded-2xl aspect-[3/4] flex flex-col group transition-all duration-300 hover:shadow-xl hover:shadow-[#5b328a]/10 hover:-translate-y-1 active:scale-[0.97] border border-black/[0.02] overflow-hidden relative",
                    catImageUrl
                      ? "bg-neutral-900"
                      : "p-6 " + cardColors[i % cardColors.length]
                  )}
                >
                  {catImageUrl ? (
                    <>
                      <Image
                        src={catImageUrl}
                        alt={cat.name}
                        fill
                        sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
                        className="object-cover opacity-75 group-hover:opacity-85 group-hover:scale-105 transition-all duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="relative mt-auto p-6">
                        <h3 className="text-lg font-black text-white leading-tight drop-shadow-md">
                          {cat.name}
                        </h3>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-11 w-11 rounded-xl bg-white/80 backdrop-blur-sm flex items-center justify-center mb-auto shadow-sm">
                        <Coffee className="h-5 w-5 text-neutral-500" />
                      </div>
                      <h3 className="text-[15px] font-bold text-neutral-800 leading-tight mt-3">
                        {cat.name}
                      </h3>
                    </>
                  )}
                </button>
              )
            })
          )}
        </div>
      ) : (
        /* ── LIST MODE: accordion categories with product table ── */
        <div>
          {allCats.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <Coffee className="h-10 w-10 text-neutral-200 mb-3" />
              <p className="text-neutral-400 text-sm">Нет категорий</p>
            </div>
          ) : (
            <>
              {/* Group by parent category */}
              {categories.map((parentCat) => {
                const childCategories = parentCat.children ?? []
                const subs = childCategories.length > 0 ? childCategories : [parentCat]
                return (
                  <div key={parentCat.id} className="mb-6">
                    {/* Parent label */}
                    {childCategories.length > 0 && (
                      <p className="text-[10px] font-bold text-neutral-300 tracking-[0.2em] uppercase mb-2">
                        {parentCat.name}
                      </p>
                    )}

                    {/* Subcategory accordions */}
                    {subs.map((cat) => (
                      <ListCategorySection
                        key={cat.id}
                        category={cat}
                        isExpanded={expandedListIds.has(cat.id)}
                        onToggle={() => toggleListCategory(cat.id)}
                        favoriteIds={favoriteIds}
                        sortMode={sortMode}
                        filterMode={filterMode}
                      />
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── List mode: category section with product table ──
function ListCategorySection({
  category,
  isExpanded,
  onToggle,
  favoriteIds,
  sortMode,
  filterMode,
}: {
  category: CatalogCategory
  isExpanded: boolean
  onToggle: () => void
  favoriteIds: string[]
  sortMode: SortMode
  filterMode: FilterMode
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isExpanded || loaded) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchCategoryProducts(category.id, controller.signal)
        .then((data) => {
          setProducts(data)
          setLoaded(true)
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          console.error(error)
          setProducts([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isExpanded, loaded, category.id])

  const filteredAndSorted = useMemo(() => {
    let result = [...products]

    // Filter by tag slug
    if (filterMode !== "all") {
      result = result.filter((p) =>
        p.stickers?.some((t) => t.slug === filterMode)
      )
    }

    // Sort
    if (sortMode === "alphabetical") {
      result.sort((a, b) => a.name.localeCompare(b.name, "ru"))
    } else if (sortMode === "price") {
      result.sort((a, b) => {
        const priceA = a.variants?.[0]?.price ?? 0
        const priceB = b.variants?.[0]?.price ?? 0
        return priceA - priceB
      })
    }

    return result
  }, [products, sortMode, filterMode])

  return (
    <div className="border-b border-neutral-100">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-3.5 text-left group hover:bg-white/50 transition-colors rounded-lg px-1"
      >
        <h3 className="text-[14px] font-black text-neutral-900 uppercase tracking-wide">
          {category.name}
        </h3>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-400" />
        )}
      </button>

      {isExpanded && (
        <div className="pb-4">
          {loading ? (
            <div className="py-6 flex justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-[#faead5] border-t-[#5b328a] animate-spin" />
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="py-4 text-[12px] text-neutral-400 px-1">
              {filterMode !== "all"
                ? "Нет товаров с выбранным фильтром"
                : "Товары скоро появятся"}
            </div>
          ) : (
            <div>
              {filteredAndSorted.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  isFavorite={favoriteIds.includes(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Grid mode: product card ──
function ProdCard({ product, idx }: { product: Product; idx: number }) {
  const { items, addItem, updateQuantity, removeItem } = useCart()
  const variants = product.variants ?? []
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [added, setAdded] = useState(false)
  const imageUrl = product.images?.[0] || null

  const selectedVariant = variants[selectedIdx]
  const grindOption = selectedVariant?.grind_options?.[0] || ""
  const showSingleVariantName = variants.length === 1 && !isSinglePieceVariantName(selectedVariant?.name)

  // Find matching cart item
  const cartItem = items.find(
    (i) =>
      i.product_id === String(product.id) &&
      i.variant_id === String(selectedVariant?.id || "") &&
      (i.grind_option || "") === grindOption
  )
  const cartQty = cartItem?.quantity ?? 0

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (!selectedVariant) return
    if (cartItem) {
      await updateQuantity(cartItem.id, cartItem.quantity + 1)
    } else {
      await addItem({
        productId: String(product.id),
        variantId: String(selectedVariant.id || idx),
        quantity: 1,
        grindOption: grindOption || undefined,
      })
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  async function handleDecrement(e: React.MouseEvent) {
    e.preventDefault()
    if (!cartItem) return
    if (cartItem.quantity <= 1) {
      await removeItem(cartItem.id)
    } else {
      await updateQuantity(cartItem.id, cartItem.quantity - 1)
    }
  }

  return (
    <div
      className="group bg-white rounded-[18px] overflow-hidden flex flex-col border border-black/[0.03] hover:shadow-xl hover:shadow-[#5b328a]/10 transition-all duration-400 hover:-translate-y-1 animate-fade-in-up"
      style={{
        animationDelay: `${idx * 60}ms`,
        animationFillMode: "backwards",
      }}
    >
      <div className="aspect-square bg-gradient-to-br bg-[#faead5] flex items-center justify-center overflow-hidden relative">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Coffee className="h-10 w-10 text-neutral-200" />
        )}
        {product.q_grader_rating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <Star className="h-2.5 w-2.5 text-[#e6610d] fill-[#e6610d]" />
            <span className="text-[10px] font-bold text-white">
              Q{product.q_grader_rating}
            </span>
          </div>
        )}
      </div>

      {product.stickers?.length > 0 && (
        <div className="flex gap-1 px-4 pt-3">
          {product.stickers.map((tag) => (
            <span
              key={tag.id}
              className={cn(
                "text-[9px] font-bold px-2 py-0.5 rounded-full",
                tag.color === "purple" ? "bg-[#faead5] text-[#5b328a]" : "bg-[#faead5] text-[#e6610d]"
              )}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="p-4 pt-2 flex-1 flex flex-col">
        <Link
          href={`/dashboard/product/${product.id}`}
          className="flex-1 min-w-0"
        >
          <h4 className="text-[13px] font-bold text-neutral-900 leading-tight group-hover:text-[#5b328a] transition-colors line-clamp-2 text-left">
            {product.name}
          </h4>
          {product.region && (
            <p className="text-[11px] text-neutral-400 mt-0.5 truncate text-left">
              {product.region}
            </p>
          )}
        </Link>

        {variants.length > 0 && (
          <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2.5">
            {/* Variant selector */}
            {variants.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                {variants.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={(e) => { e.preventDefault(); setSelectedIdx(i) }}
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all",
                      selectedIdx === i
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                    )}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}

            {/* Price + cart controls */}
            {selectedVariant && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[15px] font-black text-neutral-900">
                    {formatPrice(selectedVariant.price)}
                  </span>
                  {showSingleVariantName && (
                    <span className="text-[10px] text-neutral-400 ml-1">
                      {selectedVariant.name}
                    </span>
                  )}
                </div>

                {cartQty > 0 ? (
                  <div className="flex items-center bg-[#5b328a]/10 rounded-full">
                    <button
                      onClick={handleDecrement}
                      className="h-8 w-8 flex items-center justify-center text-[#5b328a] hover:bg-[#5b328a]/20 rounded-full transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-[12px] font-bold text-[#5b328a]">
                      {cartQty}
                    </span>
                    <button
                      onClick={handleAdd}
                      className="h-8 w-8 flex items-center justify-center text-[#5b328a] hover:bg-[#5b328a]/20 rounded-full transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAdd}
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-300",
                      added
                        ? "bg-[#5b328a] text-white scale-110 shadow-lg shadow-[#5b328a]/30"
                        : "bg-[#5b328a] text-white hover:bg-[#4a2870] hover:shadow-md active:scale-90"
                    )}
                  >
                    {added ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
