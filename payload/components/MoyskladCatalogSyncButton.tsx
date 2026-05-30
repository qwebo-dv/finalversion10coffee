"use client"

import React, { useState } from "react"

interface SyncStats {
  productTypesCreated?: number
  productTypesUpdated?: number
  categoriesCreated?: number
  categoriesUpdated?: number
  categoriesDeleted?: number
  productsCreated?: number
  productsUpdated?: number
  productsDeleted?: number
  variantsImported?: number
  clientCategoryDiscountsDeleted?: number
  skippedProducts?: string[]
}

interface SyncResponse {
  ok?: boolean
  error?: string
  stats?: SyncStats
}

export default function MoyskladCatalogSyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResponse | null>(null)

  async function runSync() {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/products/moysklad/import", {
        method: "POST",
        credentials: "include",
      })
      const json = (await response.json()) as SyncResponse
      setResult(json)
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось запустить синхронизацию",
      })
    } finally {
      setLoading(false)
    }
  }

  const stats = result?.stats

  return (
    <div
      style={{
        margin: "30px 60px",
        padding: "20px",
        border: "1px solid #e5e5e5",
        borderRadius: "12px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>МойСклад: каталог</h2>
          <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>
            Автоматическая синхронизация идет раз в сутки в 00:00 МСК. Кнопка запускает обновление сразу.
          </p>
        </div>
        <button
          type="button"
          onClick={runSync}
          disabled={loading}
          style={{
            padding: "10px 16px",
            borderRadius: "999px",
            border: "1px solid #5b328a",
            background: loading ? "#ede9f3" : "#5b328a",
            color: loading ? "#5b328a" : "#fff",
            cursor: loading ? "wait" : "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Синхронизация..." : "Синхронизировать каталог"}
        </button>
      </div>

      {result && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: result.ok ? "#f0fdf4" : "#fef2f2",
            color: result.ok ? "#166534" : "#991b1b",
            fontSize: "13px",
          }}
        >
          {result.ok ? (
            <span>
              Готово: типов {stats?.productTypesCreated || 0}/{stats?.productTypesUpdated || 0}, категорий{" "}
              {stats?.categoriesCreated || 0}/{stats?.categoriesUpdated || 0}, товаров{" "}
              {stats?.productsCreated || 0}/{stats?.productsUpdated || 0}, вариантов {stats?.variantsImported || 0}.
              Удалено: категорий {stats?.categoriesDeleted || 0}, товаров {stats?.productsDeleted || 0}, скидок на
              удаленные категории {stats?.clientCategoryDiscountsDeleted || 0}.
            </span>
          ) : (
            <span>{result.error || "Ошибка синхронизации"}</span>
          )}
        </div>
      )}
    </div>
  )
}
