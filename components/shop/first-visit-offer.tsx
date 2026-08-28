"use client"

import Image from "next/image"
import { useCallback, useEffect, useId, useState, type CSSProperties } from "react"
import { ArrowRight, Check, Coffee, Copy, Sparkles, X } from "lucide-react"
import { openAuthModal } from "@/components/auth/auth-modal-store"
import { useAuth } from "@/providers/auth-provider"
import type { ShopPopupAppearance, ShopPopupContent } from "@/lib/shop-popup-settings"

const DISMISSED_STORAGE_KEY = "10coffee-shop-first-order-offer-dismissed"

function storageKey(version: number) {
  return `${DISMISSED_STORAGE_KEY}-v${version}`
}

function rememberDismissal(version: number) {
  try {
    window.localStorage.setItem(storageKey(version), "1")
  } catch {
    // The banner still closes when storage is unavailable (for example, in a
    // locked-down private browsing session).
  }
}

function OfferTitle({ title, accentColor }: { title: string; accentColor: string }) {
  const match = title.match(/10\s*%\s+на\s+первый\s+заказ/i)
  if (!match || match.index === undefined) return title
  const start = match.index
  const end = start + match[0].length
  return <>{title.slice(0, start)}<span style={{ color: accentColor }}>{title.slice(start, end)}</span>{title.slice(end)}</>
}

function CopyPromoCode({ promoCode, appearance }: { promoCode: string; appearance: ShopPopupAppearance }) {
  const [copied, setCopied] = useState(false)

  async function copyPromoCode() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promoCode)
      } else {
        const input = document.createElement("textarea")
        input.value = promoCode
        input.setAttribute("readonly", "")
        input.style.position = "fixed"
        input.style.opacity = "0"
        document.body.appendChild(input)
        input.select()
        const copiedWithFallback = document.execCommand("copy")
        input.remove()
        if (!copiedWithFallback) throw new Error("Copy command was rejected")
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copyPromoCode}
      className="group mt-1 flex items-center gap-2 rounded-lg text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ color: appearance.promoPlateTextColor, outlineColor: appearance.accentColor }}
      aria-label={`Скопировать промокод ${promoCode}`}
      title="Скопировать промокод"
    >
      <span className="font-black tracking-[0.14em]" style={{ fontSize: appearance.promoCodeFontSize }}>{promoCode}</span>
      {copied ? <Check className="h-4 w-4 text-[#6ee7a8]" /> : <Copy className="h-4 w-4 opacity-55 transition group-hover:opacity-100" />}
      <span className="sr-only" aria-live="polite">{copied ? "Промокод скопирован" : ""}</span>
      {copied ? <span className="text-[10px] font-bold tracking-normal text-[#6ee7a8]">Скопировано</span> : null}
    </button>
  )
}

function CoffeePackArtwork({ caption, promoCode, packageImageUrl, appearance }: { caption: string; promoCode: string; packageImageUrl?: string | null; appearance: ShopPopupAppearance }) {
  return (
    <div className="relative flex h-full flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-4 pr-12">
        <Image src="/logo.svg" alt="10coffee" width={138} height={52} className="h-9 w-auto brightness-0 invert sm:h-10" priority />
        <span className="hidden max-w-[175px] text-right font-bold uppercase leading-4 tracking-[0.15em] opacity-65 sm:block" style={{ color: appearance.visualTextColor, fontSize: appearance.visualCaptionFontSize }}>{caption}</span>
      </div>

      <div className="relative mx-auto flex min-h-[285px] w-full max-w-[370px] flex-1 items-center justify-center md:min-h-0">
        <div className="relative z-[2] h-[265px] w-[315px] sm:h-[315px] sm:w-[365px] md:h-[350px] md:w-[390px]">
          <div className="absolute inset-x-[13%] bottom-[3%] h-10 rounded-[50%] bg-[#1d1d1b]/30 blur-md" />
          {packageImageUrl ? (
            <div
              role="img"
              aria-label="Изображение упаковки кофе"
              className="absolute inset-0 scale-[1.5] bg-contain bg-center bg-no-repeat drop-shadow-[0_28px_35px_rgba(29,12,6,0.38)] sm:scale-[1.55] md:scale-[1.6]"
              style={{ backgroundImage: `url(${JSON.stringify(packageImageUrl)})` }}
            />
          ) : (
            <Image
              src="/landing/assortment/webp/honduras.webp"
              alt="Пачка свежеобжаренного кофе 10coffee"
              fill
              sizes="(max-width: 640px) 315px, (max-width: 768px) 365px, 390px"
              className="scale-[1.5] object-contain drop-shadow-[0_28px_35px_rgba(29,12,6,0.38)] sm:scale-[1.55] md:scale-[1.6]"
              priority
            />
          )}
          <div className="absolute right-1 top-5 flex h-20 w-20 rotate-6 flex-col items-center justify-center rounded-full border-4 border-white text-white shadow-[0_16px_32px_rgba(29,12,6,0.35)] sm:right-0 sm:top-8 sm:h-24 sm:w-24" style={{ backgroundColor: appearance.accentColor }}>
            <span className="text-[27px] font-black leading-none tracking-[-0.06em] sm:text-[32px]">10%</span>
            <span className="mt-1 text-[7px] font-black uppercase tracking-[0.13em] sm:text-[8px]">на первый</span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] font-black shadow-xl backdrop-blur sm:text-xs" style={{ color: appearance.promoPlateTextColor, backgroundColor: appearance.promoPlateBackgroundColor }}>
        <Coffee className="h-4 w-4" style={{ color: appearance.accentColor }} />
        <span>1 бонус = 1 ₽</span>
      </div>

      <div className="relative flex items-center justify-between gap-3 rounded-2xl border border-white/15 px-4 py-3 backdrop-blur sm:px-5 sm:py-4" style={{ color: appearance.promoPlateTextColor, backgroundColor: appearance.promoPlateBackgroundColor }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Ваш промокод</p>
          <CopyPromoCode promoCode={promoCode} appearance={appearance} />
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full shadow-[0_8px_24px_rgba(29,12,6,0.25)]" style={{ backgroundColor: appearance.accentColor }}>
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export function FirstVisitOffer({ content }: { content: ShopPopupContent }) {
  const { user, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  const dismiss = useCallback(() => {
    rememberDismissal(content.campaignVersion)
    setOpen(false)
  }, [content.campaignVersion])

  useEffect(() => {
    if (loading) return

    let dismissed = false
    try {
      dismissed = window.localStorage.getItem(storageKey(content.campaignVersion)) === "1"
    } catch {
      // If storage is unavailable, the visitor may still see and close the offer.
    }

    if (user) {
      rememberDismissal(content.campaignVersion)
      const frame = window.requestAnimationFrame(() => setOpen(false))
      return () => window.cancelAnimationFrame(frame)
    }

    if (!dismissed) {
      const frame = window.requestAnimationFrame(() => setOpen(true))
      return () => window.cancelAnimationFrame(frame)
    }
  }, [content.campaignVersion, loading, user])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [dismiss, open])

  function register() {
    dismiss()
    openAuthModal("register")
  }

  if (!content.enabled || !open || user) return null

  const appearance = content.appearance
  const popupStyle = {
    "--popup-title-mobile-size": `${appearance.titleMobileFontSize}px`,
    "--popup-title-desktop-size": `${appearance.titleDesktopFontSize}px`,
    "--popup-description-mobile-size": `${appearance.descriptionMobileFontSize}px`,
    "--popup-description-desktop-size": `${appearance.descriptionDesktopFontSize}px`,
    "--popup-button-mobile-size": `${appearance.buttonMobileFontSize}px`,
    "--popup-button-desktop-size": `${appearance.buttonDesktopFontSize}px`,
    backgroundColor: appearance.panelBackgroundColor,
  } as CSSProperties

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-[#1d1d1b]/70 p-3 backdrop-blur-[7px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative my-auto grid max-h-[calc(100dvh-24px)] w-full max-w-[920px] overflow-y-auto rounded-[28px] shadow-[0_36px_100px_rgba(20,12,7,0.38)] md:grid-cols-[1.08fr_0.92fr] md:overflow-hidden md:rounded-[36px]"
        style={popupStyle}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Закрыть предложение"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#1d1d1b] shadow-lg transition hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6610d] sm:right-5 sm:top-5"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="order-2 flex flex-col justify-center px-6 py-7 sm:px-10 sm:py-10 md:order-1 md:px-12 md:py-14">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-2 font-black uppercase tracking-[0.16em]" style={{ backgroundColor: appearance.badgeBackgroundColor, color: appearance.badgeTextColor, fontSize: appearance.badgeFontSize }}>
            <Sparkles className="h-4 w-4" />
            {content.badgeText}
          </div>

          <h2 id={titleId} className="max-w-xl [font-size:var(--popup-title-mobile-size)] font-black leading-[1.03] tracking-[-0.045em] md:[font-size:var(--popup-title-desktop-size)]" style={{ color: appearance.titleColor }}>
            <OfferTitle title={content.title} accentColor={appearance.accentColor} />
          </h2>

          <div
            id={descriptionId}
            className="mt-5 max-w-lg [font-size:var(--popup-description-mobile-size)] leading-6 [&_a]:font-bold [&_a]:text-[var(--popup-link-color)] [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-2 [&_strong]:font-black [&_strong]:text-[var(--popup-link-color)] md:[font-size:var(--popup-description-desktop-size)] md:leading-7"
            style={{ color: appearance.descriptionColor, "--popup-link-color": appearance.buttonBackgroundColor } as CSSProperties}
            dangerouslySetInnerHTML={{ __html: content.descriptionHtml }}
          />

          <button
            type="button"
            onClick={register}
            className="group mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-center [font-size:var(--popup-button-mobile-size)] font-black shadow-[0_16px_34px_rgba(29,12,6,0.20)] transition hover:-translate-y-0.5 hover:brightness-90 hover:shadow-[0_20px_38px_rgba(29,12,6,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:[font-size:var(--popup-button-desktop-size)]"
            style={{ backgroundColor: appearance.buttonBackgroundColor, color: appearance.buttonTextColor }}
          >
            {content.ctaLabel}
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={dismiss}
            className="mx-auto mt-4 font-semibold leading-5 underline decoration-black/20 underline-offset-4 transition hover:opacity-75"
            style={{ color: appearance.declineTextColor, fontSize: appearance.declineFontSize }}
          >
            {content.declineLabel}
          </button>
        </div>

        <div className="relative order-1 min-h-[210px] overflow-hidden px-7 py-7 sm:min-h-[250px] sm:px-10 md:order-2 md:min-h-[600px] md:px-9 md:py-10" style={{ backgroundColor: appearance.visualBackgroundColor, color: appearance.visualTextColor }}>
          <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-[#f0b8ff]/45 blur-2xl" />
          <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full opacity-75 blur-3xl" style={{ backgroundColor: appearance.visualGlowColor }} />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />

          <CoffeePackArtwork
            caption={content.visualCaption}
            promoCode={content.promoCode}
            packageImageUrl={content.visualMode === "image" ? content.visualImageUrl : null}
            appearance={appearance}
          />
        </div>
      </section>
    </div>
  )
}
