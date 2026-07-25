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
  moyskladId?: string | null
}

interface ProductDoc {
  id: string | number
  name?: string
  variants?: ProductVariant[]
  moyskladId?: string | null
  detailsSchema?: string | null
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

// Mirrors buildMoyskladStockLossLines() in lib/moysklad/sync.ts so that
// manually created orders carry the same stock-loss/retry metadata that the
// B2B checkout flow writes automatically. Without this, МойСклад retry sync
// fails with "Нет сохранённых позиций заказа для повтора МойСклад" because
// it has nothing to rebuild the order positions from.
function computeStockFields(product: ProductDoc | undefined, variant: ProductVariant | undefined, quantity: number, price: number) {
  const stockProductMoyskladId = product?.moyskladId || ""

  const isCoffeeWeightItem =
    product?.detailsSchema === "coffee" &&
    Boolean(variant?.moyskladId) &&
    Number(variant?.weightGrams) > 0

  if (!isCoffeeWeightItem) {
    return { stockProductMoyskladId, stockQuantityKg: 0, stockPricePerKg: 0 }
  }

  const weightKgPerPack = Number(variant?.weightGrams) / 1000
  const quantityKg = weightKgPerPack * (Number(quantity) || 0)
  const priceKopecks = Math.round((Number(price) || 0) * 100)
  const pricePerKg = weightKgPerPack > 0 ? Math.round(priceKopecks / weightKgPerPack) : 0

  return {
    stockProductMoyskladId,
    stockQuantityKg: Math.round(quantityKg * 1e6) / 1e6,
    stockPricePerKg: pricePerKg,
  }
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
  const stockProductMoyskladIdPath = getSiblingPath(path, "stockProductMoyskladId")
  const stockQuantityKgPath = getSiblingPath(path, "stockQuantityKg")
  const stockPricePerKgPath = getSiblingPath(path, "stockPricePerKg")

  const { setValue: setProductName } = useField<string>({ path: productNamePath })
  const { setValue: setVariantName } = useField<string>({ path: variantNamePath })
  const { value: grindOption, setValue: setGrindOption } = useField<string>({ path: grindOptionPath })
  const { setValue: setUnitPrice } = useField<number>({ path: unitPricePath })
  const { setValue: setTotalPrice } = useField<number>({ path: totalPricePath })
  const { setValue: setStockProductMoyskladId } = useField<string>({ path: stockProductMoyskladIdPath })
  const { setValue: setStockQuantityKg } = useField<number>({ path: stockQuantityKgPath })
  const { setValue: setStockPricePerKg } = useField<number>({ path: stockPricePerKgPath })

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

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId)
  const variants = selectedProduct?.variants || []
  const selectedVariant = selectedVariantIdx !== "" ? variants[Number(selectedVariantIdx)] : undefined
  const grindOptions = selectedVariant?.grindOptions || []

  // Recalculate totalPrice (and the МойСклад stock-loss fields, since they
  // scale with quantity) whenever quantity changes, using whatever unit
  // price is currently set (respects manual overrides of unitPrice).
  useEffect(() => {
    if (skipRecalcRef.current) {
      skipRecalcRef.current = false
      return
    }
    const q = Number(quantity) || 0
    const p = Number(unitPrice) || 0
    setTotalPrice(Math.round(q * p * 100) / 100)

    if (selectedProduct && selectedVariant) {
      const stock = computeStockFields(selectedProduct, selectedVariant, q, p)
      setStockProductMoyskladId(stock.stockProductMoyskladId)
      setStockQuantityKg(stock.stockQuantityKg)
      setStockPricePerKg(stock.stockPricePerKg)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity])

  function applyVariant(product: ProductDoc | undefined, variant: ProductVariant | undefined) {
    if (!product || !variant) return
    const q = Number(quantity) || 1
    const price = Number(variant.price) || 0
    setProductName(product.name || "")
    setVariantName(variant.name || "")
    setUnitPrice(price)
    setTotalPrice(Math.round(q * price * 100) / 100)

    const stock = computeStockFields(product, variant, q, price)
    setStockProductMoyskladId(stock.stockProductMoyskladId)
    setStockQuantityKg(stock.stockQuantityKg)
    setStockPricePerKg(stock.stockPricePerKg)

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
