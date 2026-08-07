"use client"

import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useState } from "react"

type SocialProvider = "yandex" | "vk" | "sberid"

const PROVIDERS: {
  id: SocialProvider
  label: string
  accent: string
  hover: string
  mark: string
}[] = [
  {
    id: "yandex",
    label: "Яндекс",
    accent: "#FC3F1D",
    hover: "hover:border-[#FC3F1D]/30",
    mark: "Я",
  },
  {
    id: "vk",
    label: "VK",
    accent: "#0077FF",
    hover: "hover:border-[#0077FF]/30",
    mark: "VK",
  },
  {
    id: "sberid",
    label: "Сбер ID",
    accent: "#21A038",
    hover: "hover:border-[#21A038]/30",
    mark: "С",
  },
]

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Вход через соцсети пока не настроен. Используйте регистрацию по email или попробуйте позже.",
  unknown_provider: "Неизвестный провайдер авторизации.",
}

export function SocialAuthButtons() {
  const searchParams = useSearchParams()
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null)

  const socialError = searchParams.get("social_error")
  const socialErrorText = socialError
    ? ERROR_MESSAGES[socialError] || decodeURIComponent(socialError)
    : null

  function startAuth(provider: SocialProvider) {
    setLoadingProvider(provider)
    window.location.href = `/api/auth/social/${provider}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-100" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-300">
          или через соцсети
        </span>
        <div className="h-px flex-1 bg-neutral-100" />
      </div>

      {socialErrorText && (
        <div className="rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3 text-[12px] text-amber-800 font-medium leading-relaxed">
          {socialErrorText}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map((provider) => {
          const loading = loadingProvider === provider.id
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => startAuth(provider.id)}
              disabled={loadingProvider !== null}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white text-[12px] font-semibold text-neutral-700 transition-all ${provider.hover} disabled:opacity-60`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: provider.accent }} />
              ) : (
                <span
                  className="flex h-5 items-center justify-center rounded-md px-1 text-[11px] font-black text-white"
                  style={{ backgroundColor: provider.accent }}
                >
                  {provider.mark}
                </span>
              )}
              <span className="hidden sm:inline">{provider.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
