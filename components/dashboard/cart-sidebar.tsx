"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { Trash2, Send, Minus, Plus, FileText, ShoppingBag, X, Coffee, Loader2, ChevronUp, MessageCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatPrice, formatWeight } from "@/lib/utils/format"
import { useCart } from "@/providers/cart-provider"
import { validatePromoCode } from "@/lib/actions/promo"
import { calculateClientDiscount, type CategoryDiscountRule, type ClientDiscountResult, type ProductDiscountRule } from "@/lib/discounts"
import { toast } from "sonner"
import type { CartItem } from "@/types"

interface CartSidebarProps {
  items: CartItem[]
  onUpdateQuantity?: (itemId: string, quantity: number) => void
  onRemoveItem?: (itemId: string) => void
  onClearCart?: () => void
  onClose?: () => void
  inPanel?: boolean
  priceListUrl?: string
  clientDiscount?: number
  categoryDiscounts?: CategoryDiscountRule[]
  productDiscounts?: ProductDiscountRule[]
  headerActions?: ReactNode
}

interface CartDiscountLine {
  key: string
  label: string
  amount: number
}

function formatDiscountPercent(percent: number) {
  return Number.isInteger(percent)
    ? String(percent)
    : percent.toLocaleString("ru-RU", { maximumFractionDigits: 1 })
}

function buildClientDiscountLines(result: ClientDiscountResult): CartDiscountLine[] {
  const grouped = new Map<string, CartDiscountLine>()

  for (const line of result.lines) {
    const isProductDiscount = line.source === "product"
    const isCategoryDiscount = line.source === "category"
    const key = isProductDiscount
      ? `product:${line.productId}:${line.discountPercent}`
      : isCategoryDiscount
      ? `category:${line.categoryId}:${line.discountPercent}`
      : `base:${line.discountPercent}`
    const scopeSuffix = isProductDiscount
      ? ` · ${line.productName || "выбранный товар"}`
      : isCategoryDiscount && line.categoryName
        ? ` · ${line.categoryName}`
        : ""
    const label = `Скидка ${formatDiscountPercent(line.discountPercent)}%${scopeSuffix}`
    const existing = grouped.get(key)

    if (existing) {
      existing.amount += line.discountAmount
    } else {
      grouped.set(key, {
        key,
        label,
        amount: line.discountAmount,
      })
    }
  }

  return Array.from(grouped.values())
}

export function CartSidebar({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onClose,
  inPanel = false,
  priceListUrl,
  clientDiscount = 0,
  categoryDiscounts = [],
  productDiscounts = [],
  headerActions,
}: CartSidebarProps) {
  const [managerMenuOpen, setManagerMenuOpen] = useState(false)
  const { appliedPromo, setAppliedPromo } = useCart()
  const [promoInput, setPromoInput] = useState("")
  const [promoExpanded, setPromoExpanded] = useState(false)
  const [promoLoading, setPromoLoading] = useState(false)

  const totalPrice = items.reduce((sum, item) => {
    return sum + (item.variant?.price ?? 0) * item.quantity
  }, 0)

  const totalWeight = items.reduce((sum, item) => {
    return sum + (item.variant?.weight_grams ?? 0) * item.quantity
  }, 0)

  // Promo discount
  const promoEligibleItems = appliedPromo?.applicableProductIds.length
    ? items.filter((item) => appliedPromo.applicableProductIds.includes(item.product_id))
    : items
  const promoEligibleSubtotal = promoEligibleItems.reduce((sum, item) => {
    return sum + (item.variant?.price ?? 0) * item.quantity
  }, 0)
  const promoDiscount = appliedPromo
    ? appliedPromo.discountType === "percentage"
      ? Math.round((promoEligibleSubtotal * appliedPromo.discountValue) / 100)
      : Math.min(appliedPromo.discountValue, promoEligibleSubtotal)
    : 0

  const clientDiscountResult = calculateClientDiscount(items, {
    discountPercent: clientDiscount,
    categoryDiscounts,
    productDiscounts,
  })
  const clientDiscountAmount = clientDiscountResult.amount

  // Use the greater of the two discounts
  const currentDiscount = Math.max(promoDiscount, clientDiscountAmount)
  const discountLines = clientDiscountAmount > promoDiscount
    ? buildClientDiscountLines(clientDiscountResult)
    : promoDiscount > 0
      ? [{
          key: "promo",
          label: appliedPromo?.discountType === "percentage"
            ? `Промокод ${formatDiscountPercent(appliedPromo.discountValue)}%${appliedPromo.applicableProductNames.length ? ` · ${appliedPromo.applicableProductNames.join(", ")}` : ""}`
            : `Промокод${appliedPromo?.applicableProductNames.length ? ` · ${appliedPromo.applicableProductNames.join(", ")}` : ""}`,
          amount: promoDiscount,
        }]
      : []
  const finalPrice = Math.max(0, totalPrice - currentDiscount)

  async function handleApplyPromo() {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    const result = await validatePromoCode(
      promoInput.trim(),
      totalPrice,
      items.map((item) => ({
        productId: item.product_id,
        subtotal: (item.variant?.price ?? 0) * item.quantity,
      }))
    )
    if (result.valid) {
      setAppliedPromo({
        promoCodeId: result.promoCodeId,
        discountAmount: result.calculatedDiscount,
        discountType: result.discountType,
        discountValue: result.discountValue,
        applicableProductIds: result.applicableProductIds,
        applicableProductNames: result.applicableProductNames,
      })
      toast.success(`Промокод применён! Скидка: ${result.calculatedDiscount.toLocaleString("ru-RU")} ₽`)
      setPromoExpanded(false)
    } else {
      toast.error(result.error)
    }
    setPromoLoading(false)
  }

  function handleRemovePromo() {
    setAppliedPromo(null)
    setPromoInput("")
    setPromoExpanded(false)
  }

  const DEFAULT_PRICE_LIST = "/Прайс 10coffee_ Март 2026г. (1).pdf"
  const priceListHref = priceListUrl || DEFAULT_PRICE_LIST

  const inner = (
    <>
      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br bg-[#faead5] flex items-center justify-center mb-4">
                <Coffee className="h-7 w-7 text-[#e6610d]/50" />
              </div>
              <p className="text-[13px] font-semibold text-neutral-900">Корзина пуста</p>
              <p className="text-[12px] text-neutral-400 mt-1.5 max-w-[200px] leading-relaxed">
                Перейдите в каталог и добавьте товары
              </p>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {items.map((item) => (
                <div key={item.id} className="group rounded-xl p-3 hover:bg-[#faead5]/40 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Image */}
                    <div className="relative h-14 w-14 rounded-xl bg-gradient-to-br bg-[#faead5] flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product?.images?.[0] ? (
                        <Image
                          src={item.product.images[0]}
                          alt={item.product?.name || ""}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <Coffee className="h-5 w-5 text-[#e6610d]/30" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-bold text-neutral-900 leading-tight line-clamp-2">
                            {item.product?.name || "Товар"}
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            {item.variant?.name}
                            {item.grind_option && ` · ${item.grind_option}`}
                          </p>
                        </div>
                        <button
                          onClick={() => onRemoveItem?.(item.id)}
                          className="sm:opacity-0 sm:group-hover:opacity-100 shrink-0 h-6 w-6 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center bg-neutral-100 rounded-lg overflow-hidden">
                          <button
                            onClick={() => item.quantity <= 1 ? onRemoveItem?.(item.id) : onUpdateQuantity?.(item.id, item.quantity - 1)}
                            className="h-7 w-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-[12px] font-bold text-neutral-900">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
                            className="h-7 w-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="text-[14px] font-black text-neutral-900">
                          {formatPrice((item.variant?.price ?? 0) * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Bottom */}
        <div className="px-3 pb-3 sm:px-5 sm:pb-5 space-y-2.5">
        {items.length > 0 && (
          <>
            {/* Total block */}
            <div className="bg-[#faead5] rounded-xl p-3 space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-[11px] text-neutral-400">Товары</span>
                <span className="text-[13px] font-semibold text-neutral-600">
                  {Math.round(totalPrice).toLocaleString("ru-RU")} ₽
                </span>
              </div>

              {discountLines.map((line) => (
                <div key={line.key} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-green-600 font-medium truncate">
                    {line.label}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-green-600 whitespace-nowrap">
                      −{line.amount.toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </div>
              ))}

              <div className="flex items-end justify-between gap-2">
                <span className="text-[12px] text-neutral-400 uppercase tracking-wider font-medium shrink-0">Итого</span>
                <span className="text-lg font-black text-neutral-900 truncate text-right">
                  {finalPrice > 0 ? `${Math.round(finalPrice).toLocaleString("ru-RU")} ₽` : "0 ₽"}
                </span>
              </div>
            </div>

            {/* Promo code */}
            {appliedPromo ? (
              <div className="flex h-10 items-center gap-2 px-3 rounded-xl bg-green-50 border border-green-100">
                <span className="text-[12px] font-semibold text-green-700 flex-1 truncate">
                  Промокод применён
                </span>
                <button
                  onClick={handleRemovePromo}
                  className="text-[11px] font-medium text-green-600 hover:text-red-500 transition-colors shrink-0"
                >
                  Отменить
                </button>
              </div>
            ) : promoExpanded ? (
              <div className="flex gap-2">
                <Input
                  value={promoInput}
                  autoFocus
                  onChange={(e) => setPromoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  placeholder="Промокод"
                  className="h-10 text-[13px] rounded-xl border-neutral-200 bg-white flex-1 min-w-0 shadow-sm"
                />
                <button
                  onClick={handleApplyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className="h-10 min-w-12 px-3 bg-neutral-500 text-white text-[11px] font-bold rounded-xl hover:bg-neutral-700 transition-colors shrink-0 disabled:opacity-60 flex items-center justify-center"
                >
                  {promoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPromoExpanded(true)}
                className="w-fit text-[12px] font-medium text-neutral-400 hover:text-[#5b328a] transition-colors"
              >
                Есть промокод?
              </button>
            )}

            {/* Checkout */}
            <Link
              href="/dashboard/checkout"
              onClick={() => onClose?.()}
              className="flex items-center justify-center w-full h-[30px] bg-[#5b328a] text-white text-[12px] font-bold tracking-wide rounded-xl hover:bg-[#4a2870] transition-all hover:shadow-lg hover:shadow-[#5b328a]/20 active:scale-[0.98]"
            >
              Оформить заказ
            </Link>
          </>
        )}

        {/* Separate blocks */}
        <div className="flex gap-2 pt-1">
          <a
            href={priceListHref}
            download
            className="flex-1 h-10 flex items-center justify-center gap-2 px-2.5 rounded-xl bg-[#faead5]/80 hover:bg-[#faead5] transition-colors text-center"
          >
            <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <FileText className="h-3.5 w-3.5 text-[#5b328a]" />
            </div>
            <p className="text-[11px] font-bold text-[#1d1d1b] leading-tight">Прайс-лист</p>
          </a>

          <div className="relative flex-1">
            {managerMenuOpen && <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-30 w-full min-w-48 overflow-hidden rounded-xl border border-black/[0.08] bg-white p-1.5 shadow-xl">
              <a href="tg://resolve?domain=Tencoffeesochi" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-neutral-900 transition hover:bg-[#e8f4fd]" onClick={() => setManagerMenuOpen(false)}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2AABEE]"><Send className="h-3 w-3 text-white" /></span>Telegram</a>
              <a href="https://max.ru/u/f9LHodD0cOKa1C5S0VRomlqqlvMnh7CX7AaTfiG3sTv28xhc-4miAZFMuj4" target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-neutral-900 transition hover:bg-[#f3edfb]" onClick={() => setManagerMenuOpen(false)}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5b328a]"><MessageCircle className="h-3 w-3 text-white" /></span>MAX</a>
            </div>}
            <button type="button" onClick={() => setManagerMenuOpen((open) => !open)} aria-expanded={managerMenuOpen} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#e8f4fd]/80 px-2.5 text-center transition-colors hover:bg-[#d4ecfa]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2AABEE] shadow-sm"><Send className="h-3 w-3 text-white" /></span>
              <span className="text-[11px] font-bold leading-tight text-neutral-900">Менеджер</span><ChevronUp className={`h-3 w-3 text-neutral-500 transition ${managerMenuOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>
    </>
  )

  if (inPanel) {
    return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{inner}</div>
  }

  return (
    <div className="hidden xl:flex w-[400px] min-w-[400px] 2xl:w-[420px] flex-col shrink-0 p-3 pl-0 min-h-0 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)]">
      {headerActions && <div className="mb-2 flex items-center justify-end gap-1.5">{headerActions}</div>}
      <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl overflow-hidden border border-black/[0.04]">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#5b328a] flex items-center justify-center">
              <ShoppingBag className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-neutral-900">Корзина</h3>
              <p className="text-[11px] text-neutral-400">
                {items.length === 0 ? "Пока пусто" : `${items.length} ${items.length === 1 ? "товар" : "товаров"} · ${formatWeight(totalWeight)}`}
              </p>
            </div>
            {items.length > 0 && (
              <button
                onClick={onClearCart}
                className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all"
                title="Очистить корзину"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {inner}
      </div>
    </div>
  )
}
