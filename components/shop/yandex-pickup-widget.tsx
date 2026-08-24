"use client"

import { useEffect, useId, useState } from "react"
import { Loader2 } from "lucide-react"
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
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
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
    }

    document.addEventListener("YaNddWidgetPointSelected", onPointSelected)

    void loadWidgetScript().then(() => {
      if (cancelled || !window.YaDelivery) return
      window.YaDelivery.createWidget({
        containerId,
        params: {
          city,
          size: { height: "450px", width: "100%" },
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
  }, [city, containerId, mode, onSelect])

  if (failed) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Не удалось загрузить карту пунктов Яндекс Доставки. Обновите страницу и попробуйте ещё раз.</p>
  }

  return <div className="relative min-h-[450px] overflow-hidden rounded-2xl border border-black/10 bg-white">
    {loading && <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-[#7d736b]"><Loader2 className="h-4 w-4 animate-spin" />Загружаем карту…</div>}
    <div id={containerId} className="h-[450px] w-full" />
  </div>
}
