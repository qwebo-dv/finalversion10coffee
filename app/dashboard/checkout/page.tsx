"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCart } from "@/providers/cart-provider"
import { createOrder } from "@/lib/actions/orders"
import { getClientDiscountConfig } from "@/lib/actions/products"
import { getClientCompanies } from "@/lib/actions/companies"
import { calculateClientDiscount, type CategoryDiscountRule, type ProductDiscountRule } from "@/lib/discounts"
import { checkoutSchema, type CheckoutFormData } from "@/lib/utils/validators"
import { getQuickComments } from "@/lib/actions/client-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowLeft, CheckCircle2, FileText, Loader2, MapPin, Package, Truck } from "lucide-react"
import { formatPrice, formatWeight } from "@/lib/utils/format"
import { DELIVERY_METHOD_LABELS, SELF_PICKUP_ADDRESS } from "@/lib/utils/constants"
import AddressInput from "@/components/shared/address-input"
import { toast } from "sonner"
import Link from "next/link"
import type { Company, DeliveryMethod } from "@/types"

type CdekDeliveryType = "courier" | "pickup"

interface CdekTariffInfo {
  price: number
  minDays: number
  maxDays: number
  name: string
}

interface CdekOffice {
  code: string
  name: string
  address_full: string
  work_time: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, loading: cartLoading, totalPrice, totalWeight, clearCart, appliedPromo } = useCart()
  const [clientDiscount, setClientDiscount] = useState(0)
  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscountRule[]>([])
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountRule[]>([])
  const promoEligibleSubtotal = appliedPromo?.applicableProductIds.length
    ? items
      .filter((item) => appliedPromo.applicableProductIds.includes(item.product_id))
      .reduce((sum, item) => sum + (item.variant?.price ?? 0) * item.quantity, 0)
    : totalPrice
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
  const clientDiscountScopeNames = Array.from(new Set(
    clientDiscountResult.lines
      .filter((line) => line.source !== "base")
      .map((line) => line.source === "product" ? line.productName : line.categoryName)
      .filter((name): name is string => Boolean(name))
  ))
  const currentDiscount = Math.max(promoDiscount, clientDiscountAmount)
  const activeDiscountLabel = currentDiscount > 0
    ? (clientDiscountAmount > promoDiscount
      ? `${clientDiscountResult.label}${clientDiscountScopeNames.length ? ` · ${clientDiscountScopeNames.join(", ")}` : ""}`
      : `Промокод${appliedPromo?.applicableProductNames.length ? ` · ${appliedPromo.applicableProductNames.join(", ")}` : ""}`)
    : ""
  const finalPrice = Math.max(0, totalPrice - currentDiscount)
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companiesError, setCompaniesError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [orderResult, setOrderResult] = useState<{ orderId: string; moyskladInvoiceCreated?: boolean } | null>(null)

  // CDEK state
  const [cityQuery, setCityQuery] = useState("")
  const [citySuggestions, setCitySuggestions] = useState<{ code: number; city: string; region: string }[]>([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const [citySearching, setCitySearching] = useState(false)
  const [selectedCity, setSelectedCity] = useState<{ code: number; city: string } | null>(null)
  const [cdekDeliveryType, setCdekDeliveryType] = useState<CdekDeliveryType>("pickup")
  const [courierTariff, setCourierTariff] = useState<CdekTariffInfo | null>(null)
  const [pickupTariff, setPickupTariff] = useState<CdekTariffInfo | null>(null)
  const [cdekLoading, setCdekLoading] = useState(false)
  const [offices, setOffices] = useState<CdekOffice[]>([])
  const [officesLoading, setOfficesLoading] = useState(false)
  const [selectedOffice, setSelectedOffice] = useState<CdekOffice | null>(null)
  const [officeFilter, setOfficeFilter] = useState("")
  const [officesExpanded, setOfficesExpanded] = useState(true)
  const [quickComments, setQuickComments] = useState<string[]>([])
  const citySearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cityDropdownRef = useRef<HTMLDivElement>(null)

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      company_id: "",
      delivery_method: "self_pickup",
      delivery_address: "",
      comment: "",
    },
  })

  const deliveryMethod = form.watch("delivery_method")

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true)
    setCompaniesError(false)
    try {
      const companiesResult = await getClientCompanies()
      const loadedCompanies = companiesResult as Company[]
      setCompanies(loadedCompanies)
      if (loadedCompanies.length === 1) {
        form.setValue("company_id", loadedCompanies[0].id, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        })
      } else if (
        loadedCompanies.length > 1
        && !loadedCompanies.some((company) => company.id === form.getValues("company_id"))
      ) {
        form.setValue("company_id", "", {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: true,
        })
      }
    } catch (error) {
      console.error("[checkout] Не удалось загрузить компании", error)
      setCompaniesError(true)
    } finally {
      setCompaniesLoading(false)
    }
  }, [form])

  useEffect(() => {
    void loadCompanies()
    void Promise.all([getQuickComments(), getClientDiscountConfig()])
      .then(([comments, discountConfig]) => {
        if (comments.length > 0) setQuickComments(comments)
        setClientDiscount(discountConfig.discountPercent || 0)
        setCategoryDiscounts(discountConfig.categoryDiscounts)
        setProductDiscounts(discountConfig.productDiscounts || [])
      })
      .catch((error) => console.error("[checkout] Не удалось загрузить настройки клиента", error))
  }, [loadCompanies])

  // Reset CDEK state when delivery method changes
  useEffect(() => {
    if (deliveryMethod !== "cdek") {
      setSelectedCity(null)
      setCourierTariff(null)
      setPickupTariff(null)
      setCityQuery("")
      setCitySuggestions([])
      setOffices([])
      setSelectedOffice(null)
    }
  }, [deliveryMethod])

  // City search with debounce
  const searchCities = useCallback((query: string) => {
    if (citySearchTimeout.current) clearTimeout(citySearchTimeout.current)
    if (query.length < 2) {
      setCitySuggestions([])
      setShowCitySuggestions(false)
      setCitySearching(false)
      return
    }
    setCitySearching(true)
    citySearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cdek/cities?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setCitySuggestions(data)
          setShowCitySuggestions(true)
        }
      } catch {
        setCitySuggestions([])
      } finally {
        setCitySearching(false)
      }
    }, 200)
  }, [])

  // Calculate tariffs when city selected
  useEffect(() => {
    if (!selectedCity || totalWeight === 0) return
    setCdekLoading(true)
    setCourierTariff(null)
    setPickupTariff(null)

    fetch("/api/cdek/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cityCode: selectedCity.code, weightGrams: totalWeight }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.courier?.length) {
          const t = data.courier[0]
          setCourierTariff({ price: t.price, minDays: t.minDays, maxDays: t.maxDays, name: t.name })
        }
        if (data.pickup?.length) {
          const t = data.pickup[0]
          setPickupTariff({ price: t.price, minDays: t.minDays, maxDays: t.maxDays, name: t.name })
        }
      })
      .catch(() => {
        setCourierTariff(null)
        setPickupTariff(null)
      })
      .finally(() => setCdekLoading(false))
  }, [selectedCity, totalWeight])

  // Load offices when city selected and pickup type chosen
  useEffect(() => {
    if (!selectedCity || cdekDeliveryType !== "pickup") {
      setOffices([])
      setSelectedOffice(null)
      return
    }
    setOfficesLoading(true)
    setSelectedOffice(null)

    fetch(`/api/cdek/offices?cityCode=${selectedCity.code}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOffices(data)
        }
      })
      .catch(() => setOffices([]))
      .finally(() => setOfficesLoading(false))
  }, [selectedCity, cdekDeliveryType])

  // Close city dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setShowCitySuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const activeTariff = cdekDeliveryType === "courier" ? courierTariff : pickupTariff
  const deliveryCost = deliveryMethod === "cdek" && activeTariff ? activeTariff.price : 0

  async function onSubmit(data: CheckoutFormData) {
    if (items.length === 0) {
      toast.error("Корзина пуста")
      return
    }

    // Validate CDEK fields
    if (data.delivery_method === "cdek") {
      if (!selectedCity) {
        toast.error("Выберите город доставки")
        return
      }
      if (cdekDeliveryType === "pickup" && !selectedOffice) {
        toast.error("Выберите пункт выдачи")
        return
      }
      if (cdekDeliveryType === "courier" && !data.delivery_address?.trim()) {
        toast.error("Введите адрес доставки")
        return
      }
    }

    if (["cap_2000", "sochi_delivery"].includes(data.delivery_method) && !data.delivery_address?.trim()) {
      toast.error("Введите адрес доставки")
      return
    }

    // Build delivery address for CDEK
    let address = data.delivery_address || ""
    if (deliveryMethod === "cdek") {
      if (cdekDeliveryType === "pickup" && selectedOffice) {
        address = `ПВЗ СДЭК: ${selectedOffice.name} — ${selectedOffice.address_full}`
      } else if (selectedCity) {
        address = `${selectedCity.city}, ${data.delivery_address || ""}`
      }
    }

    setLoading(true)
    let orderCreated = false
    try {
      const result = await createOrder({
        companyId: data.company_id,
        deliveryMethod: data.delivery_method as DeliveryMethod,
        deliveryAddress: address,
        comment: data.comment,
        promoCodeId: appliedPromo?.promoCodeId,
        discountAmount: promoDiscount || undefined,
        deliveryCost: deliveryCost || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        setOrderResult({
          orderId: result.orderId!,
          moyskladInvoiceCreated: result.moyskladInvoiceCreated,
        })
        orderCreated = true
        void clearCart().catch((error) => {
          console.error("[checkout] Не удалось очистить корзину после оформления заказа", error)
        })
      }
    } catch (error) {
      console.error("Order creation failed:", error)
      toast.error("Не удалось оформить заказ. Попробуйте ещё раз.")
    } finally {
      if (!orderCreated) setLoading(false)
    }
  }

  if (cartLoading) {
    return <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }

  if (items.length === 0 && !orderResult) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-bold">Корзина пуста</h2>
        <p className="text-muted-foreground mt-2">
          Добавьте товары для оформления заказа
        </p>
        <Button className="mt-4" asChild>
          <Link href="/dashboard/catalog">Перейти в каталог</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/catalog">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Оформление заказа
          </h1>
          <p className="text-muted-foreground">
            {items.length} позиций · {formatWeight(totalWeight)} · {formatPrice(totalPrice)}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault()
            }
          }}
          className="space-y-6"
        >
          {/* Company */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Компания</CardTitle>
            </CardHeader>
            <CardContent>
              {companiesLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Загружаем компании…
                </div>
              ) : companiesError ? (
                <div className="py-4 text-center">
                  <p className="mb-3 text-sm text-red-600">Не удалось загрузить компании. Данные не удалены.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadCompanies()}>Повторить загрузку</Button>
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Для оформления заказа нужно добавить компанию
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/companies/new">
                      Добавить компанию
                    </Link>
                  </Button>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Выберите компанию</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите компанию" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} (ИНН: {c.inn})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Доставка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="delivery_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Способ доставки</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(DELIVERY_METHOD_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {deliveryMethod === "self_pickup" && (
                <p className="text-sm text-muted-foreground">
                  Адрес самовывоза: {SELF_PICKUP_ADDRESS}
                </p>
              )}

              {deliveryMethod === "cdek" && (
                <>
                  {/* City search */}
                  <div className="relative" ref={cityDropdownRef}>
                    <FormLabel className="mb-2 block">Город доставки</FormLabel>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Введите название города..."
                        className="pl-9 pr-9"
                        value={cityQuery}
                        onChange={(e) => {
                          setCityQuery(e.target.value)
                          setSelectedCity(null)
                          setCourierTariff(null)
                          setPickupTariff(null)
                          setOffices([])
                          setSelectedOffice(null)
                          setOfficeFilter("")
                          searchCities(e.target.value)
                        }}
                        onFocus={() => {
                          if (citySuggestions.length > 0) setShowCitySuggestions(true)
                        }}
                      />
                      {citySearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {showCitySuggestions && citySuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-48 overflow-y-auto">
                        {citySuggestions.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors"
                            onClick={() => {
                              setSelectedCity({ code: c.code, city: c.city })
                              setCityQuery(`${c.city}, ${c.region}`)
                              setShowCitySuggestions(false)
                            }}
                          >
                            <span className="font-medium">{c.city}</span>
                            <span className="text-muted-foreground ml-1">({c.region})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delivery type toggle: courier vs pickup */}
                  {selectedCity && (
                    <div>
                      <FormLabel className="mb-2 block">Тип доставки</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCdekDeliveryType("pickup")}
                          className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                            cdekDeliveryType === "pickup"
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          <Package className="h-4 w-4 flex-shrink-0" />
                          <div className="text-left">
                            <div>В пункт выдачи</div>
                            {pickupTariff && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                от {formatPrice(pickupTariff.price)}
                              </div>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCdekDeliveryType("courier")}
                          className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                            cdekDeliveryType === "courier"
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          <Truck className="h-4 w-4 flex-shrink-0" />
                          <div className="text-left">
                            <div>Курьером</div>
                            {courierTariff && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                от {formatPrice(courierTariff.price)}
                              </div>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading tariffs */}
                  {cdekLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Рассчитываем стоимость доставки...
                    </div>
                  )}

                  {/* Tariff result */}
                  {activeTariff && !cdekLoading && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                        {cdekDeliveryType === "courier" ? (
                          <Truck className="h-4 w-4" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                        {activeTariff.name}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-green-700">
                          {activeTariff.minDays}–{activeTariff.maxDays} дней
                        </span>
                        <span className="font-bold text-green-800">
                          {formatPrice(activeTariff.price)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* PVZ selection for pickup */}
                  {cdekDeliveryType === "pickup" && selectedCity && (
                    <div>
                      <FormLabel className="mb-2 block">
                        Пункт выдачи
                        {offices.length > 0 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({offices.length})
                          </span>
                        )}
                      </FormLabel>
                      {officesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Загружаем пункты выдачи...
                        </div>
                      ) : offices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Нет доступных пунктов выдачи в этом городе
                        </p>
                      ) : selectedOffice && !officesExpanded ? (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{selectedOffice.name}</div>
                            <div className="text-muted-foreground text-xs mt-0.5">{selectedOffice.address_full}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOfficesExpanded(true)}
                            className="text-xs text-primary hover:underline shrink-0 ml-3"
                          >
                            Изменить
                          </button>
                        </div>
                      ) : (
                        <>
                          {offices.length > 5 && (
                            <Input
                              placeholder="Поиск по адресу..."
                              className="mb-2"
                              value={officeFilter}
                              onChange={(e) => setOfficeFilter(e.target.value)}
                            />
                          )}
                          <div className="space-y-1 max-h-60 overflow-y-auto rounded-lg border p-1">
                            {offices
                              .filter((o) => {
                                if (!officeFilter) return true
                                const q = officeFilter.toLowerCase()
                                return (
                                  o.address_full.toLowerCase().includes(q) ||
                                  o.name.toLowerCase().includes(q)
                                )
                              })
                              .map((office) => (
                                <button
                                  key={office.code}
                                  type="button"
                                  onClick={() => { setSelectedOffice(office); setOfficesExpanded(false); }}
                                  className={`w-full text-left rounded-md p-2.5 text-sm transition-colors ${
                                    selectedOffice?.code === office.code
                                      ? "bg-primary/10 border border-primary/30"
                                      : "hover:bg-neutral-50 border border-transparent"
                                  }`}
                                >
                                  <div className="font-medium">{office.name}</div>
                                  <div className="text-muted-foreground text-xs mt-0.5">
                                    {office.address_full}
                                  </div>
                                  {office.work_time && (
                                    <div className="text-muted-foreground text-xs mt-0.5">
                                      {office.work_time}
                                    </div>
                                  )}
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Delivery address for courier */}
                  {cdekDeliveryType === "courier" && selectedCity && (
                    <FormField
                      control={form.control}
                      name="delivery_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Адрес доставки</FormLabel>
                          <FormControl>
                            <AddressInput placeholder="Улица, дом, квартира" value={field.value} onChange={field.onChange} city={selectedCity?.city} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {["cap_2000", "sochi_delivery"].includes(deliveryMethod) && (
                <FormField
                  control={form.control}
                  name="delivery_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес доставки</FormLabel>
                      <FormControl>
                        <AddressInput
                          placeholder={deliveryMethod === "sochi_delivery" ? "Сочи, улица, дом, квартира" : "Город, улица, дом"}
                          value={field.value}
                          onChange={field.onChange}
                          city={deliveryMethod === "sochi_delivery" ? "Сочи" : undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Comment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Комментарий</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickComments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {quickComments.map((qc, i) => {
                    const currentComment = form.getValues("comment") || ""
                    const isActive = currentComment.includes(qc)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            form.setValue("comment", currentComment.replace(qc, "").replace(/\s{2,}/g, " ").trim())
                          } else {
                            form.setValue("comment", currentComment ? `${currentComment}\n${qc}` : qc)
                          }
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          isActive
                            ? "bg-primary/10 border-primary/30 text-primary font-medium"
                            : "bg-muted border-transparent text-muted-foreground hover:border-neutral-300"
                        }`}
                      >
                        {qc}
                      </button>
                    )
                  })}
                </div>
              )}
              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Комментарий к заказу (необязательно)"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Товары</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Общий вес</span>
                <span>{formatWeight(totalWeight)}</span>
              </div>
              {currentDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">{activeDiscountLabel}</span>
                  <span className="text-green-600 font-medium">
                    −{formatPrice(currentDiscount)}
                  </span>
                </div>
              )}
              {deliveryCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{DELIVERY_METHOD_LABELS[deliveryMethod]}</span>
                  <span>{formatPrice(deliveryCost)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Итого</span>
                <span className="text-primary">{formatPrice(finalPrice + deliveryCost)}</span>
              </div>
            </CardContent>
          </Card>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="consent"
              required
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="mt-0.5 accent-[#5b328a] w-4 h-4 shrink-0"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Принимаю{" "}
              <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                политику конфиденциальности
              </a>{" "}
              и{" "}
              <a href="/Политика обработки персональных данных пользователей сайта.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                правила обработки персональных данных
              </a>
              , а также ознакомлен с{" "}
              <a href="/delivery" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                условиями доставки
              </a>
            </span>
          </label>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || companiesLoading || companiesError || companies.length === 0 || !privacyAgreed}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Оформить заказ
          </Button>
        </form>
      </Form>

      <Dialog
        open={!!orderResult}
        onOpenChange={(open) => {
          if (!open) router.push("/dashboard")
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl">Заказ оформлен!</DialogTitle>
            <DialogDescription>
              Мы свяжемся с вами для подтверждения заказа
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {!orderResult?.moyskladInvoiceCreated && (
              <Button asChild className="w-full">
                <a
                  href={`/api/invoice?orderId=${orderResult?.orderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Скачать счёт
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/dashboard")}
            >
              К заказам
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
