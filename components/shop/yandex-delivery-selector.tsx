"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, Package, Truck } from "lucide-react"
import AddressInput from "@/components/shared/address-input"
import { YandexPickupWidget } from "@/components/shop/yandex-pickup-widget"
import { getShopYandexDeliveryPickupPoints, searchShopYandexDeliveryLocations } from "@/lib/actions/yandex-delivery"
import { quoteShopYandexDelivery } from "@/lib/actions/shop-orders"
import { formatPrice } from "@/lib/utils/format"
import { formatDeliveryDateRange } from "@/lib/utils/delivery-estimate"
import type { ShopOrderInput, ShopYandexDeliveryQuote } from "@/lib/actions/shop-orders"
import type { YandexDeliveryMode, YandexDeliveryPickupPoint } from "@/lib/yandex-delivery"

export type ShopYandexDeliverySelection = {
  deliveryType: YandexDeliveryMode
  destinationGeoId: number
  address: string
  pickupPoint?: YandexDeliveryPickupPoint
  deliveryCost: number
  deliveryFrom?: string
  deliveryTo?: string
}

type Location = { geoId: number; address: string }

function fullCourierAddress(city: string, address: string) {
  const trimmed = address.trim()
  if (!trimmed) return ""
  const locality = city.split(",")[0]?.trim() || city.trim()
  return trimmed.toLocaleLowerCase("ru-RU").includes(locality.toLocaleLowerCase("ru-RU"))
    ? trimmed
    : `${locality}, ${trimmed}`
}

export function YandexDeliverySelector({
  items,
  fullName,
  email,
  phone,
  defaultAddress,
  onChange,
}: {
  items: ShopOrderInput["items"]
  fullName: string
  email: string
  phone: string
  defaultAddress: string
  onChange: (selection: ShopYandexDeliverySelection | null) => void
}) {
  const [query, setQuery] = useState("")
  const [locations, setLocations] = useState<Location[]>([])
  const [location, setLocation] = useState<Location | null>(null)
  const [mode, setMode] = useState<YandexDeliveryMode>("pickup_point")
  const [points, setPoints] = useState<YandexDeliveryPickupPoint[]>([])
  const [point, setPoint] = useState<YandexDeliveryPickupPoint | null>(null)
  const [courierAddress, setCourierAddress] = useState(defaultAddress)
  const [quote, setQuote] = useState<ShopYandexDeliveryQuote | null>(null)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testMode, setTestMode] = useState(true)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!testMode || !location || mode === "courier") return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoadingPoints(true)
      setError(null)
      void getShopYandexDeliveryPickupPoints({ geoId: location.geoId, type: mode }).then((result) => {
        if (cancelled) return
        setTestMode(result.testMode)
        setPoints(result.data)
        if (result.error) setError(result.error)
        if (!result.error && result.data.length === 0) setError("В этом населённом пункте нет доступных точек")
      }).finally(() => { if (!cancelled) setLoadingPoints(false) })
    })
    return () => { cancelled = true }
  }, [location, mode, testMode])

  useEffect(() => {
    let cancelled = false
    const destinationAddress = mode === "courier" && location
      ? fullCourierAddress(location.address, courierAddress)
      : point ? `Яндекс Доставка: ${point.name} — ${point.address}` : ""
    const ready = Boolean(
      location
      && fullName.trim().length >= 2
      && /^\S+@\S+\.\S+$/.test(email.trim())
      && phone.trim().length >= 6
      && (mode === "courier" ? destinationAddress.length >= 4 : point),
    )
    if (!ready || !location) {
      queueMicrotask(() => {
        if (!cancelled) {
          setQuote(null)
          onChange(null)
        }
      })
      return () => { cancelled = true }
    }
    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingQuote(true)
        setError(null)
      }
    })
    const timeout = window.setTimeout(() => {
      void quoteShopYandexDelivery({
        items,
        deliveryType: mode,
        pickupPointId: point?.id,
        destinationAddress,
        destinationGeoId: location.geoId,
        fullName,
        email,
        phone,
      }).then((nextQuote) => {
        if (cancelled) return
        setQuote(nextQuote)
        if (!nextQuote.available) {
          setError(nextQuote.message || "Не удалось рассчитать доставку")
          onChange(null)
          return
        }
        onChange({
          deliveryType: mode,
          destinationGeoId: location.geoId,
          address: destinationAddress,
          pickupPoint: point || undefined,
          deliveryCost: nextQuote.cost,
          deliveryFrom: nextQuote.deliveryFrom,
          deliveryTo: nextQuote.deliveryTo,
        })
      }).catch(() => {
        if (!cancelled) {
          setQuote(null)
          setError("Не удалось рассчитать доставку")
          onChange(null)
        }
      }).finally(() => { if (!cancelled) setLoadingQuote(false) })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [courierAddress, email, fullName, items, location, mode, onChange, phone, point])

  function search(value: string) {
    setQuery(value)
    setLocation(null)
    setLocations([])
    setPoint(null)
    setQuote(null)
    onChange(null)
    if (timer.current) window.clearTimeout(timer.current)
    if (value.trim().length < 2) return
    timer.current = window.setTimeout(() => {
      setLoadingLocations(true)
      setError(null)
      void searchShopYandexDeliveryLocations(value).then((result) => {
        setTestMode(result.testMode)
        setLocations(result.data)
        if (result.error) setError(result.error)
      }).finally(() => setLoadingLocations(false))
    }, 250)
  }

  function selectLocation(nextLocation: Location) {
    setLocation(nextLocation)
    setQuery(nextLocation.address)
    setLocations([])
    setPoint(null)
    setPoints([])
    setQuote(null)
    onChange(null)
  }

  function selectMode(nextMode: YandexDeliveryMode) {
    setMode(nextMode)
    setError(null)
    setPoint(null)
    setPoints([])
    setQuote(null)
    onChange(null)
  }

  return <div className="mt-5 space-y-4">
    {testMode && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Тестовый режим Яндекс Доставки: для проверки доступны только московские адреса. Боевые отправления не создаются.</p>}
    <div>
      <label className="mb-2 block text-xs font-bold text-[#655c55]">Город доставки</label>
      <div className="relative"><MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d736b]" /><input value={query} onChange={(event) => search(event.target.value)} className="h-12 w-full rounded-2xl border border-black/10 py-0 pl-10 pr-10 outline-none focus:border-[#5b328a]" placeholder={testMode ? "Москва" : "Введите город"} />{loadingLocations && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#7d736b]" />}</div>
      {locations.length > 0 && !location && <div className="mt-1 max-h-48 overflow-y-auto rounded-2xl border border-black/10 bg-white p-1 shadow-lg">{locations.map((candidate) => <button key={candidate.geoId} type="button" onClick={() => selectLocation(candidate)} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f8f5f1]"><b>{candidate.address}</b></button>)}</div>}
    </div>
    {location && <>
      <div><label className="mb-2 block text-xs font-bold text-[#655c55]">Способ получения</label><div className="grid gap-3 sm:grid-cols-3">{([
        ["pickup_point", "Пункт выдачи", Package],
        ["terminal", "Постамат", Package],
        ["courier", "Курьером", Truck],
      ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => selectMode(value)} className={`rounded-2xl border p-3 text-left text-sm font-bold ${mode === value ? "border-[#5b328a] bg-[#f4edfa] text-[#5b328a]" : "border-black/10"}`}><Icon className="mb-2 h-4 w-4" />{label}</button>)}</div></div>
      {mode === "courier" ? <label className="block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Улица, дом, квартира</span><AddressInput name="yandex-address" required value={courierAddress} onChange={setCourierAddress} city={location.address} className="h-12 rounded-2xl border-black/10 px-4 focus-visible:border-[#5b328a] focus-visible:ring-0" placeholder="Начните вводить улицу" /><span className="mt-2 block text-xs text-[#7d736b]">Стоимость появится после выбора полного адреса с улицей и номером дома.</span></label> : testMode ? <div className="space-y-3"><label className="block text-xs font-bold text-[#655c55]">{mode === "terminal" ? "Постамат" : "Пункт выдачи"}</label>{loadingPoints && <p className="flex items-center gap-2 text-sm text-[#7d736b]"><Loader2 className="h-4 w-4 animate-spin" />Загружаем точки…</p>}<div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-black/10 bg-white p-1">{points.map((item) => <button key={item.id} type="button" onClick={() => setPoint(item)} className={`block w-full rounded-xl p-3 text-left text-sm ${point?.id === item.id ? "bg-[#f4edfa] text-[#5b328a]" : "hover:bg-[#f8f5f1]"}`}><b>{item.name}</b><span className="mt-1 block text-xs text-[#7d736b]">{item.address}</span></button>)}{!loadingPoints && points.length === 0 && <p className="p-3 text-sm text-[#7d736b]">Выберите другой город или способ получения.</p>}</div></div> : <div className="space-y-3"><label className="block text-xs font-bold text-[#655c55]">{mode === "terminal" ? "Выберите постамат на карте" : "Выберите пункт выдачи на карте"}</label><YandexPickupWidget city={location.address} mode={mode} onSelect={setPoint} />{point && <div className="rounded-2xl border border-[#5b328a]/20 bg-[#f4edfa] p-3 text-sm text-[#5b328a]"><b>{point.name}</b><span className="mt-1 block text-xs">{point.address}</span></div>}</div>}
      {loadingQuote && <p className="flex items-center gap-2 text-sm text-[#7d736b]"><Loader2 className="h-4 w-4 animate-spin" />Рассчитываем стоимость доставки…</p>}
      {!loadingQuote && quote?.available && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><div className="flex justify-between gap-3"><b>Яндекс Доставка</b><b>{formatPrice(quote.cost)}</b></div>{formatDeliveryDateRange(quote.deliveryFrom, quote.deliveryTo) && <p className="mt-1 text-xs">Ориентировочная доставка: {formatDeliveryDateRange(quote.deliveryFrom, quote.deliveryTo)}</p>}</div>}
    </>}
    {error && <p className="text-sm text-red-700">{error}</p>}
  </div>
}
