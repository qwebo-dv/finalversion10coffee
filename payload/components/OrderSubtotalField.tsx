"use client"

import { useEffect, useMemo, useRef } from "react"
import { useAllFormFields, useField, useFormInitializing } from "@payloadcms/ui"
import { calculateOrderLineDiscounts } from "@/lib/order-line-discounts"

export default function OrderSubtotalField({ path }: { path: string }) {
  const { value, setValue } = useField<number>({ path })
  const [fields, dispatchFields] = useAllFormFields()
  const initializing = useFormInitializing()
  const previousDiscountPercentRef = useRef<number | null>(null)

  const itemRows = useMemo(() => Object.keys(fields || {})
    .filter((key) => /^items\.\d+\.totalPrice$/.test(key))
    .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))
    .map((totalPath) => ({
      totalPath,
      totalPrice: Number(fields[totalPath]?.value) || 0,
      discountPercentPath: totalPath.replace(/totalPrice$/, "discountPercent"),
      discountAmountPath: totalPath.replace(/totalPrice$/, "discountAmount"),
    })), [fields])

  const itemTotals = useMemo(
    () => Math.round(itemRows.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100,
    [itemRows],
  )

  const computed = useMemo(() => itemTotals, [itemTotals])
  const discountPercent = Number(fields?.discountPercent?.value) || 0
  const lineTotalsSignature = itemRows.map((item) => item.totalPrice).join("|")

  useEffect(() => {
    if (computed !== (Number(value) || 0)) {
      setValue(computed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed])

  useEffect(() => {
    if (initializing) return

    const previousDiscountPercent = previousDiscountPercentRef.current
    previousDiscountPercentRef.current = discountPercent

    // A zero order-level percentage may coexist with position-level promo or
    // product discounts. Preserve those on initial load. We only clear lines
    // when a manager explicitly changes a non-zero order discount back to 0.
    if (discountPercent <= 0 && (previousDiscountPercent === null || previousDiscountPercent <= 0)) {
      return
    }

    const discounts = calculateOrderLineDiscounts(itemRows, discountPercent)
    itemRows.forEach((item, index) => {
      const line = discounts[index]
      if (!line) return

      if ((Number(fields[item.discountPercentPath]?.value) || 0) !== line.discountPercent) {
        dispatchFields({
          type: "UPDATE",
          path: item.discountPercentPath,
          value: line.discountPercent,
        })
      }
      if ((Number(fields[item.discountAmountPath]?.value) || 0) !== line.discountAmount) {
        dispatchFields({
          type: "UPDATE",
          path: item.discountAmountPath,
          value: line.discountAmount,
        })
      }
    })

    const discountAmount = discounts.reduce((sum, line) => sum + line.discountAmount, 0)
    if ((Number(fields?.discountAmount?.value) || 0) !== discountAmount) {
      dispatchFields({ type: "UPDATE", path: "discountAmount", value: discountAmount })
    }
    // Values of the generated fields are intentionally excluded: including
    // them would re-run this effect once for every dispatched update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discountPercent, dispatchFields, initializing, lineTotalsSignature])

  return (
    <div>
      <input
        type="number"
        value={value ?? 0}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{
          width: "100%",
          padding: "7px 8px",
          borderRadius: "4px",
          border: "1px solid #d0d0d0",
          fontSize: "13px",
        }}
      />
      <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
        Автоматически суммируется из позиций заказа. Можно скорректировать вручную.
      </div>
    </div>
  )
}
