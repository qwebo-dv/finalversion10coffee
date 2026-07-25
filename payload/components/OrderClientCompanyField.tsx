"use client"

import { useEffect, useRef, useState } from "react"
import { useDocumentInfo, useField, useFormFields } from "@payloadcms/ui"

interface ClientCompany {
  name?: string
  inn?: string
}

interface ClientDoc {
  companies?: ClientCompany[]
  discountPercent?: number
}

interface PromoCodeDoc {
  code?: string
  discountType?: "percentage" | "fixed_amount"
  discountValue?: number
}

function getRelationshipId(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "string") return String(value)
  if (!value || typeof value !== "object") return null
  const record = value as { id?: unknown; value?: unknown }
  if (typeof record.id === "number" || typeof record.id === "string") return String(record.id)
  if (typeof record.value === "number" || typeof record.value === "string") return String(record.value)
  return null
}

export default function OrderClientCompanyField() {
  const { id: docId } = useDocumentInfo()
  const isNewDoc = !docId

  const clientValue = useFormFields(([fields]) => fields?.client?.value)
  const clientId = getRelationshipId(clientValue)
  const promoCodeValue = useFormFields(([fields]) => fields?.promoCode?.value)
  const promoCodeId = getRelationshipId(promoCodeValue)
  const currentCompanyInn = useFormFields(([fields]) => fields?.companyInn?.value) as string | undefined
  const subtotal = useFormFields(([fields]) => fields?.subtotal?.value) as number | undefined

  const { setValue: setCompanyName } = useField<string>({ path: "companyName" })
  const { setValue: setCompanyInn } = useField<string>({ path: "companyInn" })
  const { setValue: setDiscountPercent } = useField<number>({ path: "discountPercent" })

  const [companies, setCompanies] = useState<ClientCompany[]>([])
  const [clientDiscount, setClientDiscount] = useState<number | null>(null)
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null)
  const [promoLabel, setPromoLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState("")

  const firstRunRef = useRef(true)
  const promoFirstRunRef = useRef(true)
  // Both discount sources (клиент / промокод) can resolve independently and
  // asynchronously — keep the latest of each in refs so whichever resolves
  // second can still compare against the other instead of clobbering it.
  const clientDiscountRef = useRef(0)
  const promoDiscountRef = useRef(0)

  // Применяем скидку клиента и скидку по промокоду вместе — используется
  // бОльшая из двух (как при оформлении заказа на сайте), а не складывается.
  function applyBestDiscount() {
    setDiscountPercent(Math.max(clientDiscountRef.current, promoDiscountRef.current))
  }

  useEffect(() => {
    if (!clientId) {
      setCompanies([])
      setClientDiscount(null)
      clientDiscountRef.current = 0
      return
    }

    // При открытии уже существующего заказа не перезаписываем сохранённые
    // компанию/скидку сразу при загрузке формы — только при осознанной
    // смене клиента (для нового заказа автозаполнение работает сразу).
    const skipAutoFill = firstRunRef.current && !isNewDoc

    const controller = new AbortController()
    setLoading(true)

    void fetch(`/api/clients/${clientId}?depth=0`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: ClientDoc | null) => {
        const list = Array.isArray(doc?.companies) ? doc!.companies! : []
        const discount = Number(doc?.discountPercent) || 0
        setCompanies(list)
        setClientDiscount(discount)
        clientDiscountRef.current = discount

        if (!skipAutoFill) {
          applyBestDiscount()
          if (list.length === 1) {
            setCompanyName(list[0].name || "")
            setCompanyInn(list[0].inn || "")
            setSelectedIndex("0")
          } else {
            setSelectedIndex("")
          }
        } else {
          const matchIdx = list.findIndex((c) => c.inn && c.inn === currentCompanyInn)
          setSelectedIndex(matchIdx >= 0 ? String(matchIdx) : "")
        }

        firstRunRef.current = false
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setCompanies([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  // Промокод выбирается вручную менеджером в разделе "Промокод и заметки" —
  // применяется свободно, без проверки срока действия/лимита использований
  // (это ручное создание заказа, а не оформление клиентом на сайте).
  useEffect(() => {
    if (!promoCodeId) {
      setPromoDiscount(null)
      setPromoLabel(null)
      promoDiscountRef.current = 0
      return
    }

    const skipAutoFill = promoFirstRunRef.current && !isNewDoc
    const controller = new AbortController()

    void fetch(`/api/promo-codes/${promoCodeId}?depth=0`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: PromoCodeDoc | null) => {
        const value = Number(doc?.discountValue) || 0
        const sub = Number(subtotal) || 0
        const equivalentPercent = doc?.discountType === "fixed_amount"
          ? (sub > 0 ? Math.min(100, (value / sub) * 100) : 0)
          : Math.min(100, value)

        setPromoDiscount(equivalentPercent)
        setPromoLabel(
          doc?.discountType === "fixed_amount"
            ? `${value.toLocaleString("ru-RU")} ₽`
            : `${value}%`
        )
        promoDiscountRef.current = equivalentPercent

        if (!skipAutoFill) {
          applyBestDiscount()
        }

        promoFirstRunRef.current = false
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoCodeId])

  function handleSelect(indexStr: string) {
    setSelectedIndex(indexStr)
    const company = indexStr !== "" ? companies[Number(indexStr)] : undefined
    if (company) {
      setCompanyName(company.name || "")
      setCompanyInn(company.inn || "")
    }
  }

  return (
    <div style={{ padding: "6px 0 16px 0" }}>
      <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#1d1d1b" }}>
        Компания клиента
      </div>

      {!clientId ? (
        <div style={{ fontSize: "13px", color: "#888" }}>
         Сначала выберите клиента выше — появится список его компаний, а скидка подставится автоматически.
      </div>
      ) : loading ? (
        <div style={{ fontSize: "13px", color: "#888" }}>Загрузка данных клиента…</div>
      ) : (
        <>
          {companies.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#888", marginBottom: "6px" }}>
              У клиента нет сохранённых компаний. Заполните поля «Компания» и «ИНН» вручную ниже.
            </div>
          ) : (
            <select
              value={selectedIndex}
              onChange={(e) => handleSelect(e.target.value)}
              style={{
                width: "100%",
                maxWidth: "480px",
                padding: "8px 10px",
                borderRadius: "4px",
                border: "1px solid #d0d0d0",
                fontSize: "13px",
                background: "#fff",
              }}
            >
              <option value="">— выберите компанию —</option>
              {companies.map((c, i) => (
                <option key={i} value={i}>
                  {c.name || "Без названия"}
                  {c.inn ? ` (ИНН ${c.inn})` : ""}
                </option>
              ))}
            </select>
          )}
          {clientDiscount !== null && (
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              Скидка клиента: <strong>{clientDiscount}%</strong>
              {promoDiscount !== null && (
                <>
                  {" · "}Промокод: <strong>{promoLabel}</strong>
                </>
              )}
              {" — в поле «Скидка (%)» подставлена бОльшая из них ("}
              <strong>{Math.max(clientDiscount, promoDiscount ?? 0)}%</strong>
              {"). При необходимости её можно скорректировать вручную в боковой панели."}
            </div>
          )}
        </>
      )}
    </div>
  )
}
