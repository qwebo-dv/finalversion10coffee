"use client"

import React, { useState } from "react"

interface RetryOrderResult {
  id: string | number
  orderId?: string
  success: boolean
  error?: string
}

interface RetryResponse {
  ok?: boolean
  error?: string
  checked?: number
  retryable?: number
  due?: number
  succeeded?: number
  failed?: number
  retried?: RetryOrderResult[]
}

export default function MoyskladOrderRetryButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RetryResponse | null>(null)

  async function runRetry() {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/orders/moysklad/retry", {
        method: "POST",
        credentials: "include",
      })
      const json = (await response.json()) as RetryResponse
      setResult(json)
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось запустить повторную синхронизацию заказов",
      })
    } finally {
      setLoading(false)
    }
  }

  const failedOrders = result?.retried?.filter((item) => !item.success) || []

  return (
    <div
      style={{
        margin: "0 0 24px",
        padding: "20px",
        border: "1px solid #e5e5e5",
        borderRadius: "12px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>МойСклад: заказы</h2>
          <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>
            Кнопка проверит все заказы без ID заказа в МойСклад и сразу повторит выгрузку.
          </p>
        </div>
        <button
          type="button"
          onClick={runRetry}
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
          {loading ? "Отправка заказов..." : "Повторить выгрузку заказов"}
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
              Готово: проверено {result.checked || 0}, к выгрузке {result.retryable || 0}, отправлено{" "}
              {result.succeeded || 0}, ошибок {result.failed || 0}.
            </span>
          ) : (
            <div>
              <div>{result.error || "Повторная синхронизация завершилась с ошибками"}</div>
              <div style={{ marginTop: "6px" }}>
                Проверено {result.checked || 0}, к выгрузке {result.retryable || 0}, отправлено {result.succeeded || 0},
                ошибок {result.failed || 0}.
              </div>
              {failedOrders.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: "18px" }}>
                  {failedOrders.slice(0, 5).map((order) => (
                    <li key={String(order.id)}>
                      {order.orderId || order.id}: {order.error || "ошибка синхронизации"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
