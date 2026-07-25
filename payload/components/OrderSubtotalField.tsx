"use client"

import { useEffect, useMemo } from "react"
import { useField, useFormFields } from "@payloadcms/ui"

export default function OrderSubtotalField({ path }: { path: string }) {
  const { value, setValue } = useField<number>({ path })

  const itemTotals = useFormFields(([fields]) => {
    const sum = Object.keys(fields || {}).reduce((acc, key) => {
      if (/^items\.\d+\.totalPrice$/.test(key)) {
        return acc + (Number(fields[key]?.value) || 0)
      }
      return acc
    }, 0)
    return Math.round(sum * 100) / 100
  }) as number

  const computed = useMemo(() => itemTotals, [itemTotals])

  useEffect(() => {
    if (computed !== (Number(value) || 0)) {
      setValue(computed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed])

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
