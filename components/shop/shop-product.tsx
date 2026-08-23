"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Check, CheckCircle2, Coffee, Leaf, Loader2, Minus, Paperclip, Plus, ShoppingBag } from "lucide-react"
import { useGuestCart } from "@/providers/guest-cart-provider"
import { useAuth } from "@/providers/auth-provider"
import { openAuthModal } from "@/components/auth/auth-modal-store"
import { ShopHeader } from "@/components/shop/shop-header"
import { AdminEditProductLink } from "@/components/shop/admin-edit-product-link"
import { ShopFavoriteButton } from "@/components/shop/shop-favorite-button"
import { StarRating } from "@/components/shop/star-rating"
import { CoffeeTasteScale } from "@/components/shop/coffee-acidity"
import { CoffeeBrewingGuides } from "@/components/shop/coffee-brewing-guides"
import { formatPrice, formatWeight } from "@/lib/utils/format"
import { addRecentlyViewed } from "@/lib/recently-viewed"
import { getTagColorStyle } from "@/lib/tag-color"
import { findVariantForSelection, getGrindOptions, getVariantGrindOption, getVariantWeights, GRIND_OPTION_LABELS } from "@/lib/shop-variant-options"
import type { CoffeeBrewingGuide, Product, ProductTypeOption } from "@/types"

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
  // Контент описания приходит из редактора: исходные размеры медиа не должны
  // увеличивать ширину страницы на узких экранах.
  "[&_p]:break-words [&_li]:break-words [&_a]:break-all",
  "[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-2xl [&_img]:shadow-md",
  "[&_iframe]:max-w-full",
].join(" ")

interface SpecRow {
  label: string
  value: string
}

function isSinglePieceVariantName(name: string | undefined) {
  return /^1\s*шт\.?$/i.test((name || "").trim())
}

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

export function ShopProduct({
  product,
  products,
  productTypes,
  isFavorite = false,
  coffeeBrewingGuides = [],
}: {
  product: Product
  products: Product[]
  productTypes?: ProductTypeOption[]
  isFavorite?: boolean
  coffeeBrewingGuides?: CoffeeBrewingGuide[]
}) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const variants = (product.variants || []).filter((item) => item.is_available)
  const [variant, setVariant] = useState(variants[0] || null)
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const { items, addItem } = useGuestCart()

  useEffect(() => {
    addRecentlyViewed(product.id, product.slug)
  }, [product.id, product.slug])

  const [vote, setVote] = useState(0)
  const [authorName, setAuthorName] = useState("")
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [voteDone, setVoteDone] = useState(false)
  const [reviewEligibility, setReviewEligibility] = useState<"checking" | "eligible" | "not-eligible" | "failed">("checking")

  useEffect(() => {
    if (authLoading) {
      setReviewEligibility("checking")
      return
    }
    if (!user) return

    let cancelled = false
    setReviewEligibility("checking")
    fetch(`/api/shop/product-reviews?product=${encodeURIComponent(product.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Review eligibility request failed")
        return response.json() as Promise<{ canReview?: boolean }>
      })
      .then((data) => {
        if (!cancelled) setReviewEligibility(data.canReview ? "eligible" : "not-eligible")
      })
      .catch(() => {
        if (!cancelled) setReviewEligibility("failed")
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, product.id, user])

  const images = product.images.length > 0 ? product.images : []
  const subtitle = [product.region, product.processing_method].filter(Boolean).join(" · ")
  const reviews = product.reviews || []
  const inCart = items.some((item) => item.productId === product.id && item.variantId === variant?.id)
  const weights = getVariantWeights(variants)
  const selectedWeight = variant?.weight_grams || weights[0] || null
  const selectedGrind = getVariantGrindOption(variant)
  const grindOptions = getGrindOptions(variants, selectedWeight)
  const hasStructuredCoffeeOptions = product.product_type_schema === "coffee" && weights.length > 0 && grindOptions.length > 0
  const showSimpleVariantSelector = variants.length > 1 || !isSinglePieceVariantName(variants[0]?.name)

  const specs: SpecRow[] = [
    typeof product.q_grader_rating === "number" ? { label: "Оценка Q-грейдера", value: String(product.q_grader_rating) } : null,
    product.roast_level ? { label: "Степень обжарки", value: product.roast_level } : null,
    product.country ? { label: "Страна", value: product.country } : null,
    product.region ? { label: "Регион", value: product.region } : null,
    product.processing_method ? { label: "Способ обработки", value: product.processing_method } : null,
    product.roaster ? { label: "Ростер", value: product.roaster } : null,
    product.growing_height ? { label: "Высота произрастания", value: product.growing_height } : null,
  ].filter((entry): entry is SpecRow => entry !== null)

  function addToCart() {
    if (!variant) return
    addItem({ productId: product.id, variantId: variant.id, quantity })
  }

  function scrollToReview() {
    document.getElementById("shop-review-form")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  async function submitVote() {
    if (!user) {
      openAuthModal("login")
      return
    }
    if (!vote) return
    setSubmitting(true)
    setVoteError(null)
    try {
      const response = await fetch("/api/shop/product-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: product.id,
          rating: vote,
          authorName: authorName.trim() || undefined,
          comment: comment.trim() || undefined,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        console.error("[review] POST failed", response.status, body)
        throw new Error(body?.error || "Не удалось отправить отзыв")
      }
      setVoteDone(true)
      router.refresh()
    } catch (error) {
      console.error("[review] submit error", error)
      setVoteError("Что-то пошло не так. Попробуйте ещё раз.")
    } finally {
      setSubmitting(false)
    }
  }

  const isCoffee = product.product_type_schema === "coffee"
  const isTea = product.product_type_schema === "tea"

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
      <ShopHeader products={products} productTypes={productTypes} />

      <div className="mx-auto max-w-[1320px] px-5 pb-24 pt-8 lg:px-8 2xl:max-w-[1480px] 2xl:px-10 2xl:pb-28 2xl:pt-10">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-sm text-[#8d827a]">
          <Link href="/shop" className="font-bold text-[#6f655e] transition hover:text-[#5b328a]">Каталог</Link>
          <span className="text-[#c3b8af]">/</span>
          <Link href={`/${product.product_type}`} className="font-semibold text-[#6f655e] transition hover:text-[#5b328a]">{product.product_type_name}</Link>
          <span className="text-[#c3b8af]">/</span>
          <span className="font-bold text-[#1d1d1b]">{product.name}</span>
        </nav>

        {/* Hero: gallery + buy panel */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12 2xl:mt-10 2xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] 2xl:gap-16">
          {/* Gallery */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-[#faead5] shadow-[0_30px_90px_rgba(45,27,17,0.12)]">
              {images[imageIndex] ? (
                <Image src={images[imageIndex]} alt={product.name} fill className="object-cover" sizes="(min-width: 1024px) 55vw, 100vw" priority />
              ) : (
                <div className="flex h-full items-center justify-center"><Coffee className="h-28 w-28 text-[#e6610d]/30" /></div>
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

          {/* Buy panel */}
          <div>
            <div className="mb-4 flex justify-end"><AdminEditProductLink productId={product.id} /></div>
            {product.stickers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.stickers.map((sticker) => <span key={sticker.id} style={getTagColorStyle(sticker.color)} className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">{sticker.name}</span>)}
              </div>
            )}
            <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-[#e6610d]">{product.product_type_name}</p>
            <h1 className="shop-product-title mt-3 font-black leading-[0.98] tracking-[-0.05em]">{product.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <StarRating value={product.rating} count={product.reviews_count} size="lg" />
              {!product.reviews_count && (
                <button type="button" onClick={scrollToReview} className="inline-flex items-center text-sm font-semibold text-[#8d827a] transition hover:text-[#5b328a]">
                  Пока не оценили
                </button>
              )}
            </div>
            {subtitle && <p className="mt-4 text-lg text-[#6e655e]">{subtitle}</p>}
            {isCoffee && (product.taste_description || product.acidity || product.bitterness || product.sweetness || product.body) && (
              <div className="mt-5 rounded-[22px] border border-[#7540ad]/10 bg-white/70 px-5 py-4">
                {product.taste_description && (
                  <p className="text-sm leading-6 text-[#554b43]"><span className="font-black text-[#1d1d1b]">Во вкусе:</span> {product.taste_description}</p>
                )}
                <div className={`${product.taste_description ? "mt-4" : ""} grid max-w-sm gap-2.5`}>
                  <CoffeeTasteScale label="Горечь" value={product.bitterness} />
                  <CoffeeTasteScale label="Сладость" value={product.sweetness} />
                  <CoffeeTasteScale label="Кислотность" value={product.acidity} />
                  <CoffeeTasteScale label="Плотность" value={product.body} />
                </div>
              </div>
            )}

            {/* Packaging */}
            <div className="mt-8 2xl:mt-10">
              {hasStructuredCoffeeOptions ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8d827a]">Фасовка</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {weights.map((weight) => (
                        <button key={weight} type="button" onClick={() => { const nextVariant = findVariantForSelection(variants, weight, selectedGrind); if (nextVariant) setVariant(nextVariant); setQuantity(1) }} className={`min-w-[88px] rounded-2xl border-2 px-4 py-3 text-sm font-black transition ${selectedWeight === weight ? "border-[#5b328a] bg-white text-[#5b328a] shadow-[0_10px_30px_rgba(91,50,138,0.12)]" : "border-black/10 bg-white/60 text-[#1d1d1b] hover:border-black/25"}`}>
                          {formatWeight(weight)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8d827a]">Формат</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {grindOptions.map((option) => (
                        <button key={option} type="button" onClick={() => { const nextVariant = findVariantForSelection(variants, selectedWeight, option); if (nextVariant) setVariant(nextVariant); setQuantity(1) }} className={`rounded-2xl border-2 px-4 py-3 text-sm font-black transition ${selectedGrind === option ? "border-[#1d1d1b] bg-[#1d1d1b] text-white shadow-lg" : "border-black/10 bg-white/60 text-[#1d1d1b] hover:border-black/25"}`}>
                          {GRIND_OPTION_LABELS[option] || option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-[#9b9087] sm:col-span-2">Помол бесплатный. Цена выбранного SKU обновляется автоматически.</p>
                </div>
              ) : showSimpleVariantSelector ? (
                <>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8d827a]">Вариант</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {variants.map((item) => (
                      <button key={item.id} type="button" onClick={() => { setVariant(item); setQuantity(1) }} className={`min-w-[96px] rounded-2xl border-2 px-5 py-4 text-left transition ${variant?.id === item.id ? "border-[#5b328a] bg-white shadow-[0_10px_30px_rgba(91,50,138,0.12)]" : "border-black/10 bg-white/60 hover:border-black/25"}`}>
                        <span className={`block text-sm font-black ${variant?.id === item.id ? "text-[#5b328a]" : "text-[#1d1d1b]"}`}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Price + quantity + CTA */}
            <div className="mt-8 flex items-end justify-between gap-6 2xl:mt-10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8d827a]">Цена</p>
                <p className="mt-2 text-4xl font-black tracking-tight">{variant ? formatPrice(variant.price) : "—"}</p>
              </div>
              <div className="flex items-center rounded-full bg-white p-1 shadow-sm">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-11 w-11 rounded-full text-[#6f655e] transition hover:bg-[#f5f1ed]"><Minus className="mx-auto h-4 w-4" /></button>
                <span className="w-10 text-center text-sm font-black">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="h-11 w-11 rounded-full text-[#6f655e] transition hover:bg-[#f5f1ed]"><Plus className="mx-auto h-4 w-4" /></button>
              </div>
            </div>

            <button type="button" onClick={addToCart} disabled={!variant} className={`mt-8 flex h-16 w-full items-center justify-center gap-3 rounded-full text-base font-black text-white shadow-xl transition disabled:opacity-40 ${inCart ? "bg-[#e6610d] shadow-[#e6610d]/25 hover:bg-[#cf5206]" : "bg-[#1d1d1b] shadow-black/15 hover:bg-black"}`}>
              {inCart ? <Check className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}{inCart ? "В корзине" : `Добавить в корзину · ${variant ? formatPrice(variant.price * quantity) : "—"}`}
            </button>
            <ShopFavoriteButton productId={product.id} initialIsFavorite={isFavorite} variant="detail" />
          </div>
        </div>

        {isCoffee && <CoffeeBrewingGuides guides={coffeeBrewingGuides} />}

        {isTea && product.brewing_instructions && product.brewing_instructions.length > 0 ? (
          <section className="mt-16">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faead5]">
                <Leaf className="h-5 w-5 text-[#5b328a]" />
              </div>
              <h2 className="text-xl font-black tracking-tight">Как заваривать</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {product.brewing_instructions.map((instruction, index) => (
                <article key={index} className="flex items-center gap-4 rounded-[20px] border border-black/[0.06] bg-white p-4 shadow-sm">
                  {instruction.image_url && <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#faead5]"><Image src={instruction.image_url} alt={instruction.title} fill className="object-cover" sizes="64px" /></div>}
                  <div className="min-w-0"><h3 className="font-bold">{instruction.title}</h3><p className="mt-0.5 line-clamp-2 text-sm leading-5 text-[#6e655e]">{instruction.text}</p></div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* Lower: description + characteristics */}
        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
          <section>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e6610d]">Описание</p>
            <h2 className="mt-3 mb-3 text-3xl font-black tracking-[-0.03em]">{product.name}</h2>
            {product.description ? (
              <div className={DESCRIPTION_HTML_CLASSNAME} dangerouslySetInnerHTML={{ __html: product.description }} />
            ) : (
              <p className="mt-6 text-[14px] leading-7 text-[#6e655e]">Описание скоро появится. Свежая обжарка, отличное качество — проверьте другие характеристики товара.</p>
            )}
          </section>

          <aside className="space-y-10">
            {specs.length > 0 && (
              <div className="rounded-[28px] bg-white p-8 shadow-[0_20px_60px_rgba(45,27,17,0.07)]">
                <h2 className="text-xl font-black tracking-tight">Характеристики</h2>
                <dl className="mt-5 divide-y divide-black/[0.05]">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex items-baseline justify-between gap-6 py-3.5">
                      <dt className="text-sm text-[#9b9087]">{spec.label}</dt>
                      <dd className="text-right text-sm font-bold">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {product.attached_files && product.attached_files.length > 0 && (
              <div>
                <h2 className="text-xl font-black tracking-tight">Документы</h2>
                <div className="mt-4 space-y-2">
                  {product.attached_files.map((file) => (
                    <a key={file.name} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-[#5b328a] shadow-sm transition hover:shadow-md">
                      <Paperclip className="h-4 w-4" /> {file.name}{file.size ? <span className="ml-auto text-xs font-semibold text-[#9b9087]">{(file.size / 1024).toFixed(0)} КБ</span> : null}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Reviews */}
        <div className="mt-24 grid gap-12 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-16">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e6610d]">Отзывы</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em]">Оценки покупателей</h2>
            <div className="mt-7 flex items-end gap-4">
              <span className="text-7xl font-black leading-none tracking-tight">{typeof product.rating === "number" ? product.rating.toFixed(1) : "—"}</span>
              <div className="pb-1.5"><StarRating value={product.rating} count={product.reviews_count} size="lg" showValue={false} /></div>
            </div>
            {reviews.length > 0 && <p className="mt-3 text-sm text-[#8d827a]">Средняя оценка из {reviews.length} отзывов</p>}

            <div id="shop-review-form" className="mt-9 rounded-[28px] bg-white p-7 shadow-[0_20px_60px_rgba(45,27,17,0.07)]">
              {authLoading || (user && reviewEligibility === "checking") ? (
                <div className="py-6 text-center text-sm font-semibold text-[#766d66]">Проверяем историю заказов...</div>
              ) : !user ? (
                <div className="text-center">
                  <h3 className="text-lg font-black">Хотите оставить отзыв?</h3>
                  <p className="mt-2 text-sm leading-6 text-[#766d66]">Отзывы могут оставлять только зарегистрированные покупатели.</p>
                  <button type="button" onClick={() => openAuthModal("login")} className="mt-5 w-full rounded-full bg-[#5b328a] px-6 py-4 text-sm font-black text-white transition hover:bg-[#47256e]">Войти в аккаунт</button>
                </div>
              ) : reviewEligibility === "not-eligible" ? (
                <div className="text-center">
                  <h3 className="text-lg font-black">Отзыв доступен после получения товара</h3>
                  <p className="mt-2 text-sm leading-6 text-[#766d66]">Оставить отзыв могут покупатели, у которых этот товар есть в оплаченном и доставленном заказе.</p>
                </div>
              ) : reviewEligibility === "failed" ? (
                <div className="text-center">
                  <h3 className="text-lg font-black">Не удалось проверить заказ</h3>
                  <p className="mt-2 text-sm leading-6 text-[#766d66]">Попробуйте обновить страницу. Отзыв не будет сохранён без подтверждённой покупки.</p>
                </div>
              ) : voteDone ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#e8f5e9] p-4 text-sm font-bold text-[#2e7d32]"><CheckCircle2 className="h-5 w-5 shrink-0" /> Спасибо! Отзыв отправлен на модерацию и появится после проверки.</div>
              ) : (
                <>
                  <h3 className="text-lg font-black">Оцените товар</h3>
                  <div className="mt-4"><StarRating interactive onRate={setVote} value={vote} size="lg" showValue={false} /></div>
                  <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="Ваше имя (необязательно)" className="mt-5 h-12 w-full rounded-2xl border border-black/10 bg-[#f8f5f1] px-4 text-sm outline-none transition focus:border-[#5b328a]" />
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Напишите отзыв (необязательно)" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-black/10 bg-[#f8f5f1] px-4 py-3 text-sm outline-none transition focus:border-[#5b328a]" />
                  <button type="button" onClick={submitVote} disabled={!vote || submitting} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#5b328a] px-6 py-4 text-sm font-black text-white transition hover:bg-[#47256e] disabled:opacity-40">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Отправить оценку"}
                  </button>
                  {voteError && <p className="mt-3 text-sm font-semibold text-red-600">{voteError}</p>}
                </>
              )}
            </div>
          </div>

          <div>
            {reviews.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-dashed border-black/10 bg-white/60 px-8 py-20 text-center">
                <Coffee className="h-12 w-12 text-[#e6610d]/40" />
                <p className="mt-5 max-w-sm text-sm leading-6 text-[#8d827a]">Отзывов пока нет. Поставьте оценку — это займёт 10 секунд.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-[24px] bg-white p-6 shadow-[0_14px_40px_rgba(45,27,17,0.05)]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#faead5] text-sm font-black text-[#b0531a]">{(review.author_name || "Г").charAt(0).toUpperCase()}</span>
                        <span className="truncate font-bold">{review.author_name || "Гость"}</span>
                      </div>
                      <StarRating value={review.rating} showValue={false} size="sm" />
                    </div>
                    {review.comment && <p className="mt-3 text-sm leading-6 text-[#554b43]">{review.comment}</p>}
                    <p className="mt-3 text-xs text-[#aaa098]">{formatReviewDate(review.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
