"use client"

import { useEffect, useState } from "react"
import { Loader2, MapPin, Package, Truck } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import AddressInput from "@/components/shared/address-input"
import { toast } from "sonner"
import type { DeliveryMethod } from "@/types"

const DELIVERY_OPTIONS: Array<{ value: DeliveryMethod; title: string; description: string }> = [
  { value: "cdek", title: "СДЭК", description: "Доставка по всей России через пункты выдачи и курьера" },
  { value: "sochi_delivery", title: "Доставка по Сочи", description: "Курьером по городу Сочи и Адлеру" },
  { value: "self_pickup", title: "Самовывоз", description: "г. Сочи, ул. Пластунская 79/1" },
]

export default function DeliveryPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("")
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (user) {
      const savedMethod = (user.user_metadata?.delivery_method as DeliveryMethod) || ""
      setDeliveryMethod(savedMethod)
      setAddress((user.user_metadata?.address as string) || "")
    }
    setInitialized(true)
  }, [user])

  async function handleSave() {
    if (!user) {
      toast.error("Не авторизован")
      return
    }
    if (deliveryMethod === "") {
      toast.error("Выберите способ доставки")
      return
    }
    if (deliveryMethod !== "self_pickup" && !address.trim()) {
      toast.error("Укажите адрес доставки")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          delivery_method: deliveryMethod,
          address: address.trim(),
        },
      })
      if (error) throw error
      toast.success("Способы доставки обновлены")
    } catch {
      toast.error("Ошибка при сохранении")
    }
    setLoading(false)
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Способы доставки</h1>
        <p className="text-muted-foreground">
          Выберите предпочтительный способ — он будет подставляться при оформлении заказа
        </p>
      </div>

      <div className="space-y-3">
        {DELIVERY_OPTIONS.map((option) => {
          const active = deliveryMethod === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setDeliveryMethod(option.value)}
              className={`w-full rounded-2xl border-2 bg-white p-5 text-left transition ${
                active ? "border-[#5b328a] shadow-[0_10px_30px_rgba(91,50,138,0.12)]" : "border-black/10 hover:border-black/25"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#f4edfa] text-[#5b328a]" : "bg-neutral-100 text-neutral-400"}`}>
                  {option.value === "self_pickup" ? <Package className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${active ? "text-[#5b328a]" : "text-neutral-900"}`}>{option.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{option.description}</p>
                </div>
                <span className={`ml-auto h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-[#5b328a] bg-[#5b328a] shadow-inner" : "border-neutral-300"}`} />
              </div>
            </button>
          )
        })}
      </div>

      {deliveryMethod && deliveryMethod !== "self_pickup" && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-[#5b328a]" />
            Адрес доставки
          </label>
          <AddressInput
            value={address}
            onChange={setAddress}
            placeholder="Город, улица, дом, квартира"
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
          />
        </div>
      )}

      <Button onClick={handleSave} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Сохранить
      </Button>
    </div>
  )
}
