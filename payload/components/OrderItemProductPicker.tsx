"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useField, useFormFields } from "@payloadcms/ui"

interface ProductVariant {
  name?: string
  sku?: string
  price?: number
  weightGrams?: number
  isAvailable?: boolean
  grindOptions?: string[]
}

interface ProductDoc {
  id: string | number
  name?: string
  variants?: ProductVariant[]
}

const GRIND_LABELS: Record<string, string> = {
  beans: "В зёрнах",
  ground: "Молотый",
}

function getSiblingPath(path: string, siblingName: string): string {
  const parts = path.split(".")
  parts[parts.length - 1] = siblingName
  return parts.join(".")
}

const selectStyle: CSSProperties = {
  width: "100%",
  padding: "7px 8px",
  borderRadius: "4px",
  border: "1px solid #d0d0d0",
  fontSize: "13px",
  background: "#fff",
}

export default function OrderItemProductPicker({ path }: { path: string }) {
  const [products, setProducts] = useState<ProductDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedVariantIdx, setSelectedVariantIdx] = useState("")

  const quantityPath = getSiblingPath(path, "quantity")
  const productNamePath = getSiblingPath(path, "productName")
  const variantNamePath = getSiblingPath(path, "variantName")
  const grindOptionPath = getSiblingPath(path, "grindOption")
  const unitPricePath = getSiblingPath(path, "unitPrice")
  const totalPricePath = getSiblingPath(path, "totalPrice")

  const { setValue: setProductName } = useField<string>({ path: productNamePath })
  const { setValue: setVariantName } = useField<string>({ path: variantNamePath })
  const { value: grindOption, setValue: setGrindOption } = useField<string>({ path: grindOptionPath })
  const { setValue: setUnitPrice } = useField<number>({ path: unitPricePath })
  const { setValue: setTotalPrice } = useField<number>({ path: totalPricePath })

  const quantity = useFormFields(([fields]) => fields?.[quantityPath]?.value) as number | undefined
  const unitPrice = useFormFields(([fields]) => fields?.[unitPricePath]?.value) as number | undefined

  const skipRecalcRef = useRef(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    void fetch("/api/products?limit=1000&depth=0&sort=name&where[isVisible][equals]=true", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const docs = Array.isArray(data?.docs) ? (data.docs as ProductDoc[]) : []
        setProducts(docs)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  // Recalculate totalPrice whenever quantity changes, using whatever unit
  // price is currently set (respects manual overrides of unitPrice).
  useEffect(() => {
    if (skipRecalcRef.current) {
      skipRecalcRef.current = false
      return
    }
    const q = Number(quantity) || 0
    const p = Number(unitPrice) || 0
    setTotalPrice(Math.round(q * p * 100) / 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity])

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId)
  const variants = selectedProduct?.variants || []
  const selectedVariant = selectedVariantIdx !== "" ? variants[Number(selectedVariantIdx)] : undefined
  const grindOptions = selectedVariant?.grindOptions || []

  function applyVariant(product: ProductDoc | undefined, variant: ProductVariant | undefined) {
    if (!product || !variant) return
    const q = Number(quantity) || 1
    const price = Number(variant.price) || 0
    setProductName(product.name || "")
    setVariantName(variant.name || "")
    setUnitPrice(price)
    setTotalPrice(Math.round(q * price * 100) / 100)

    const options = variant.grindOptions || []
    if (options.length === 1) {
      setGrindOption(GRIND_LABELS[options[0]] || options[0])
    } else if (options.length === 0) {
      setGrindOption("")
    }
  }

  function handleProductChange(id: string) {
    setSelectedProductId(id)
    setSelectedVariantIdx("")
    const product = products.find((p) => String(p.id) === id)
    if (product?.variants?.length === 1) {
      setSelectedVariantIdx("0")
      applyVariant(product, product.variants[0])
    }
  }

  function handleVariantChange(idx: string) {
    setSelectedVariantIdx(idx)
    applyVariant(selectedProduct, idx !== "" ? variants[Number(idx)] : undefined)
  }

  function handleGrindChange(value: string) {
    setGrindOption(GRIND_LABELS[value] || value)
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: grindOptions.length > 0 ? "2fr 1fr 1fr" : "2fr 1fr",
        gap: "10px",
        padding: "8px 0",
        marginBottom: "4px",
      }}
    >
      <div>
        <div style={{ fontSize: "11px", color: "#888", marginBottom: "3px" }}>Товар из каталога</div>
        <select
          value={selectedProductId}
          onChange={(e) => handleProductChange(e.target.value)}
          style={selectStyle}
          disabled={loading}
        >
          <option value="">{loading ? "Загрузка…" : "— выбрать из каталога —"}</option>
          {products.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: "11px", color: "#888", marginBottom: "3px" }}>Фасовка</div>
        <select
          value={selectedVariantIdx}
          onChange={(e) => handleVariantChange(e.target.value)}
          style={selectStyle}
          disabled={!selectedProduct}
        >
          <option value="">— фасовка —</option>
          {variants.map((v, i) => (
            <option key={i} value={i}>
              {v.name} {v.price ? `— ${v.price} ₽` : ""}
            </option>
          ))}
        </select>
      </div>

      {grindOptions.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", color: "#888", marginBottom: "3px" }}>Помол</div>
          <select
            value={Object.keys(GRIND_LABELS).find((k) => GRIND_LABELS[k] === grindOption) || ""}
            onChange={(e) => handleGrindChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">— помол —</option>
            {grindOptions.map((g) => (
              <option key={g} value={g}>
                {GRIND_LABELS[g] || g}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
