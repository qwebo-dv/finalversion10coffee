"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MapPin, Package, Truck } from "lucide-react"
import { formatPrice } from "@/lib/utils/format"
import { CdekPickupMap } from "./cdek-pickup-map"

export type ShopCdekSelection = {
  cityCode: number
  cityName: string
  deliveryType: "pickup" | "courier"
  office?: { code: string; name: string; address: string }
  deliveryCost: number
}

type City = { code: number; city: string; region: string }
type Tariff = { code: number; price: number; minDays: number; maxDays: number; name: string; mode: number }
type Office = { code: string; name: string; address_full: string; work_time: string; type: string; location?: Record<string, unknown>; [key: string]: unknown }

export function CdekDeliverySelector({ weightGrams, defaultAddress, onChange }: { weightGrams: number; defaultAddress: string; onChange: (selection: ShopCdekSelection | null) => void }) {
  const [query, setQuery] = useState("")
  const [cities, setCities] = useState<City[]>([])
  const [city, setCity] = useState<City | null>(null)
  const [type, setType] = useState<"pickup" | "courier">("pickup")
  const [pickup, setPickup] = useState<Tariff | null>(null)
  const [courier, setCourier] = useState<Tariff | null>(null)
  const [offices, setOffices] = useState<Office[]>([])
  const [office, setOffice] = useState<Office | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTariff = type === "pickup" ? pickup : courier

  useEffect(() => {
    if (!city || weightGrams <= 0) return
    setLoading(true)
    setError(null)
    setPickup(null)
    setCourier(null)
    fetch("/api/cdek/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cityCode: city.code, weightGrams }) })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Не удалось рассчитать доставку")
        return data
      })
      .then((data) => {
        setPickup(data.pickup?.[0] || null)
        setCourier(data.courier?.[0] || null)
        if (!data.pickup?.length && !data.courier?.length) setError("Для выбранного города нет доступных тарифов СДЭК")
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Не удалось рассчитать доставку"))
      .finally(() => setLoading(false))
  }, [city, weightGrams])

  useEffect(() => {
    if (!city || type !== "pickup") {
      setOffices([])
      setOffice(null)
      return
    }
    fetch(`/api/cdek/offices?cityCode=${city.code}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить пункты выдачи")
        setOffices(Array.isArray(data) ? data : [])
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Не удалось загрузить пункты выдачи"))
  }, [city, type])

  useEffect(() => {
    if (!city || !activeTariff || (type === "pickup" && !office)) {
      onChange(null)
      return
    }
    onChange({ cityCode: city.code, cityName: city.city, deliveryType: type, office: office ? { code: office.code, name: office.name, address: office.address_full } : undefined, deliveryCost: activeTariff.price })
  }, [activeTariff, city, office, onChange, type])

  function search(value: string) {
    setQuery(value)
    setCity(null)
    setPickup(null)
    setCourier(null)
    setOffice(null)
    onChange(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length < 2) { setCities([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cdek/cities?q=${encodeURIComponent(value)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Не удалось найти город")
        setCities(Array.isArray(data) ? data : [])
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Не удалось найти город")
      }
    }, 250)
  }

  return <div className="mt-5 space-y-4">
    <div><label className="mb-2 block text-xs font-bold text-[#655c55]">Город доставки</label><div className="relative"><MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d736b]" /><input value={query} onChange={(event) => search(event.target.value)} className="h-12 w-full rounded-2xl border border-black/10 py-0 pl-10 pr-4 outline-none focus:border-[#5b328a]" placeholder="Введите город" /></div>{cities.length > 0 && !city && <div className="mt-1 max-h-48 overflow-y-auto rounded-2xl border border-black/10 bg-white p-1 shadow-lg">{cities.map((candidate) => <button key={candidate.code} type="button" onClick={() => { setCity(candidate); setQuery(`${candidate.city}, ${candidate.region}`); setCities([]) }} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f8f5f1]"><b>{candidate.city}</b><span className="ml-1 text-[#7d736b]">({candidate.region})</span></button>)}</div>}</div>
    {city && <><div><label className="mb-2 block text-xs font-bold text-[#655c55]">Тип доставки</label><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setType("pickup")} className={`rounded-2xl border p-3 text-left text-sm font-bold ${type === "pickup" ? "border-[#5b328a] bg-[#f4edfa] text-[#5b328a]" : "border-black/10"}`}><Package className="mb-2 h-4 w-4" />Пункт выдачи{pickup && <span className="mt-1 block text-xs text-[#7d736b]">от {formatPrice(pickup.price)}</span>}</button><button type="button" onClick={() => setType("courier")} className={`rounded-2xl border p-3 text-left text-sm font-bold ${type === "courier" ? "border-[#5b328a] bg-[#f4edfa] text-[#5b328a]" : "border-black/10"}`}><Truck className="mb-2 h-4 w-4" />Курьером{courier && <span className="mt-1 block text-xs text-[#7d736b]">от {formatPrice(courier.price)}</span>}</button></div></div>{loading && <p className="flex items-center gap-2 text-sm text-[#7d736b]"><Loader2 className="h-4 w-4 animate-spin" />Рассчитываем стоимость доставки…</p>}{error && <p className="text-sm text-red-700">{error}</p>}{activeTariff && !loading && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><div className="flex justify-between gap-3"><b>{activeTariff.name}</b><b>{formatPrice(activeTariff.price)}</b></div><p className="mt-1">Срок: {activeTariff.minDays}–{activeTariff.maxDays} дней</p></div>}{type === "pickup" && <div className="space-y-3"><label className="block text-xs font-bold text-[#655c55]">Пункт выдачи</label>{pickup && <CdekPickupMap cityName={city.city} offices={offices} selectedOfficeCode={office?.code} tariff={pickup} weightGrams={weightGrams} onSelect={setOffice} />} {office && <div className="rounded-2xl border border-[#5b328a]/20 bg-[#f4edfa] p-4 text-sm text-[#5b328a]"><b className="block">Выбран ПВЗ: {office.name}</b><span className="mt-1 block text-xs">{office.address_full}</span></div>}<details className="rounded-2xl border border-black/10 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-[#655c55]">Выбрать из списка ({offices.length})</summary><div className="max-h-56 space-y-1 overflow-y-auto border-t border-black/10 p-1">{offices.map((item) => <button key={item.code} type="button" onClick={() => setOffice(item)} className={`block w-full rounded-xl p-3 text-left text-sm ${office?.code === item.code ? "bg-[#f4edfa] text-[#5b328a]" : "hover:bg-[#f8f5f1]"}`}><b>{item.name}</b><span className="mt-1 block text-xs text-[#7d736b]">{item.address_full}</span></button>)}{offices.length === 0 && <p className="p-3 text-sm text-[#7d736b]">Пункты выдачи появятся после выбора города.</p>}</div></details></div>}{type === "courier" && <label className="block"><span className="mb-2 block text-xs font-bold text-[#655c55]">Адрес доставки</span><input name="address" required autoComplete="street-address" defaultValue={defaultAddress} className="h-12 w-full rounded-2xl border border-black/10 px-4 outline-none focus:border-[#5b328a]" placeholder="Улица, дом, квартира" /></label>}</>}
  </div>
}
