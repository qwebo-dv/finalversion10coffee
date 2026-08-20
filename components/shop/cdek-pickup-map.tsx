"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Loader2, Map, X } from "lucide-react"

type CdekMapOffice = {
  code: string
  name: string
  address_full: string
  work_time: string
  type: string
  location?: Record<string, unknown>
  [key: string]: unknown
}

type CdekMapTariff = {
  code: number
  name: string
  price: number
  minDays: number
  maxDays: number
  mode: number
}

type CdekWidgetInstance = {
  destroy?: () => void
  selectOffice?: (code: string) => void
}

type CdekWidgetTarget = {
  code?: string
}

type CdekWidgetConstructor = new (options: Record<string, unknown>) => CdekWidgetInstance

declare global {
  interface Window {
    CDEKWidget?: CdekWidgetConstructor
  }
}

let widgetScriptPromise: Promise<void> | null = null

function loadWidgetScript() {
  if (window.CDEKWidget) return Promise.resolve()
  if (widgetScriptPromise) return widgetScriptPromise

  widgetScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cdek-widget="3"]')
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Не удалось загрузить карту СДЭК")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/@cdek-it/widget@3.11.1"
    script.async = true
    script.dataset.cdekWidget = "3"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Не удалось загрузить карту СДЭК"))
    document.head.appendChild(script)
  }).catch((error) => {
    widgetScriptPromise = null
    throw error
  })

  return widgetScriptPromise
}

export function CdekPickupMap({
  cityName,
  offices,
  selectedOfficeCode,
  tariff,
  weightGrams,
  onSelect,
}: {
  cityName: string
  offices: CdekMapOffice[]
  selectedOfficeCode?: string
  tariff: CdekMapTariff
  weightGrams: number
  onSelect: (office: CdekMapOffice) => void
}) {
  const rawId = useId()
  const rootId = `cdek-map-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const widgetRef = useRef<CdekWidgetInstance | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_CDEK_MAP_API_KEY?.trim() || ""

  useEffect(() => {
    if (!open || !apiKey) return
    let cancelled = false

    void loadWidgetScript()
      .then(() => {
        if (cancelled || !window.CDEKWidget) return
        widgetRef.current = new window.CDEKWidget({
          apiKey,
          root: rootId,
          servicePath: "/api/cdek/widget",
          canChoose: true,
          popup: false,
          lang: "rus",
          currency: "RUB",
          defaultLocation: cityName,
          officesRaw: offices,
          tariff: {
            tariff_code: tariff.code,
            tariff_name: tariff.name,
            delivery_mode: tariff.mode,
            period_min: tariff.minDays,
            period_max: tariff.maxDays,
            delivery_sum: tariff.price,
          },
          goods: [{ length: 30, width: 20, height: 15, weight: Math.max(weightGrams / 1000, 0.1) }],
          hideDeliveryOptions: { office: false, door: true },
          onReady: () => {
            setLoading(false)
            if (selectedOfficeCode) widgetRef.current?.selectOffice?.(selectedOfficeCode)
          },
          onChoose: (deliveryType: string, _selectedTariff: unknown, target: CdekWidgetTarget) => {
            if (deliveryType !== "office" || !target?.code) return
            const selected = offices.find((office) => office.code === target.code)
            if (!selected) return
            onSelect(selected)
            setOpen(false)
          },
        })
      })
      .catch((caught) => {
        if (cancelled) return
        setLoading(false)
        setError(caught instanceof Error ? caught.message : "Не удалось открыть карту СДЭК")
      })

    return () => {
      cancelled = true
      widgetRef.current?.destroy?.()
      widgetRef.current = null
    }
  }, [apiKey, cityName, offices, onSelect, open, rootId, selectedOfficeCode, tariff, weightGrams])

  if (!apiKey) {
    return <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Карта ПВЗ появится после настройки ключа Яндекс Карт.</p>
  }

  function openMap() {
    setError(null)
    setLoading(true)
    setOpen(true)
  }

  return (
    <>
      <button type="button" onClick={openMap} disabled={offices.length === 0} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1d1b] px-5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
        <Map className="h-4 w-4" />
        {selectedOfficeCode ? "Изменить ПВЗ на карте" : "Выбрать ПВЗ на карте"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Карта пунктов выдачи СДЭК">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
              <Map className="h-5 w-5 text-[#5b328a]" />
              <div className="min-w-0 flex-1">
                <p className="font-black">Выберите пункт выдачи СДЭК</p>
                <p className="truncate text-xs text-[#7d736b]">{cityName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5" aria-label="Закрыть карту"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative min-h-0 flex-1">
              {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm text-[#7d736b]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Загружаем карту и пункты выдачи…</div>}
              {error && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-8 text-center text-sm text-red-700">{error}</div>}
              <div id={rootId} className="h-full w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
