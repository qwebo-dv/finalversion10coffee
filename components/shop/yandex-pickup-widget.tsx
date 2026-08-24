"use client"

import { useEffect, useId, useState } from "react"
import { Loader2, Map, X } from "lucide-react"
import type { YandexDeliveryPickupPoint } from "@/lib/yandex-delivery"

type WidgetMode = "pickup_point" | "terminal"

type YandexWidgetPoint = {
  id?: string
  name?: string
  type?: WidgetMode
  address?: {
    full_address?: string
    comment?: string
  }
}

type YandexDeliveryWidgetApi = {
  createWidget: (options: {
    containerId: string
    params: {
      city: string
      size: { height: string; width: string }
      show_select_button: boolean
      filter: {
        type: WidgetMode[]
        payment_methods: string[]
        payment_methods_filter: "or"
      }
    }
  }) => void
  setParams?: (params: {
    city: string
    show_select_button: boolean
    filter: {
      type: WidgetMode[]
      payment_methods: string[]
      payment_methods_filter: "or"
    }
  }) => void
}

declare global {
  interface Window {
    YaDelivery?: YandexDeliveryWidgetApi
  }
}

const SCRIPT_ID = "yandex-delivery-pvz-widget-v2"

function loadWidgetScript() {
  if (window.YaDelivery) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled || !window.YaDelivery) return
      settled = true
      window.clearTimeout(timeout)
      document.removeEventListener("YaNddWidgetLoad", finish)
      resolve()
    }
    const fail = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      document.removeEventListener("YaNddWidgetLoad", finish)
      reject(new Error("widget-load-failed"))
    }
    const timeout = window.setTimeout(fail, 15000)
    document.addEventListener("YaNddWidgetLoad", finish)

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", finish, { once: true })
      existing.addEventListener("error", fail, { once: true })
      finish()
      return
    }

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = "https://widget-pvz.dostavka.yandex.net/widget.js?v=2"
    script.async = true
    script.addEventListener("load", finish, { once: true })
    script.addEventListener("error", fail, { once: true })
    document.head.appendChild(script)
  })
}

export function YandexPickupWidget({
  city,
  mode,
  onSelect,
}: {
  city: string
  mode: WidgetMode
  onSelect: (point: YandexDeliveryPickupPoint) => void
}) {
  const reactId = useId()
  const containerId = `yandex-delivery-widget-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const onPointSelected = (event: Event) => {
      const detail = (event as CustomEvent<YandexWidgetPoint>).detail
      const id = String(detail?.id || "")
      const address = String(detail?.address?.full_address || "")
      if (!id || !address) return

      onSelect({
        id,
        name: String(detail.name || (mode === "terminal" ? "Постамат" : "Пункт выдачи")),
        type: mode,
        address,
        instruction: detail.address?.comment || undefined,
      })
      setOpen(false)
    }

    document.addEventListener("YaNddWidgetPointSelected", onPointSelected)

    void loadWidgetScript().then(() => {
      if (cancelled || !window.YaDelivery) return
      const widgetContainer = document.getElementById(containerId)
      const widgetHeight = Math.max(widgetContainer?.clientHeight || 0, 450)
      window.YaDelivery.createWidget({
        containerId,
        params: {
          city,
          // The widget does not resolve a percentage height against a flex item.
          // Give it the measured modal body height so its internal map fills the dialog.
          size: { height: `${widgetHeight}px`, width: "100%" },
          show_select_button: true,
          filter: {
            type: [mode],
            payment_methods: ["already_paid"],
            payment_methods_filter: "or",
          },
        },
      })
      setLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setLoading(false)
        setFailed(true)
      }
    })

    return () => {
      cancelled = true
      document.removeEventListener("YaNddWidgetPointSelected", onPointSelected)
    }
  }, [city, containerId, mode, onSelect, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function openMap() {
    setFailed(false)
    setLoading(true)
    setOpen(true)
  }

  return <>
    <button type="button" onClick={openMap} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1d1b] px-5 text-sm font-bold text-white transition hover:bg-black">
      <Map className="h-4 w-4" />
      {mode === "terminal" ? "Открыть карту постаматов" : "Открыть карту пунктов Яндекс Доставки"}
    </button>

    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={mode === "terminal" ? "Карта постаматов Яндекс Доставки" : "Карта пунктов выдачи Яндекс Доставки"}>
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
          <Map className="h-5 w-5 text-[#5b328a]" />
          <div className="min-w-0 flex-1">
            <p className="font-black">{mode === "terminal" ? "Выберите постамат Яндекс Доставки" : "Выберите пункт выдачи Яндекс Доставки"}</p>
            <p className="truncate text-xs text-[#7d736b]">{city}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5" aria-label="Закрыть карту"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative min-h-0 flex-1">
          {loading && <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/90 text-sm text-[#7d736b]"><Loader2 className="h-5 w-5 animate-spin" />Загружаем карту…</div>}
          {failed && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-8 text-center text-sm text-red-700">Не удалось загрузить карту пунктов Яндекс Доставки. Закройте окно, обновите страницу и попробуйте ещё раз.</div>}
          <div id={containerId} className="h-full w-full" />
        </div>
      </div>
    </div>}
  </>
}
