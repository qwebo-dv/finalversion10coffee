"use client"

import React, { useRef, useState } from "react"

interface RetryOrderResult {
  id: string | number
  orderId?: string
  success: boolean
  error?: string
}

interface LogEntry {
  message: string
  type?: string
}

interface FinalResult {
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
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [log, setLog] = useState<LogEntry[]>([])
  const [final, setFinal] = useState<FinalResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function appendLog(entry: LogEntry) {
    setLog((prev) => [...prev.slice(-99), entry])
  }

  async function runRetry() {
    setLoading(true)
    setLog([])
    setFinal(null)
    setProgress({ current: 0, total: 0 })
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch("/api/orders/moysklad/retry", {
        method: "POST",
        credentials: "include",
        signal: abort.signal,
      })

      if (!response.ok || !response.body) {
        const json = await response.json()
        setFinal({ ok: false, error: json.error || "Ошибка запроса" })
        setLoading(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw)
            if (event.type === "final") {
              setFinal({ ok: event.ok, ...event })
            } else {
              if (event.current != null && event.total != null) {
                setProgress({ current: event.current, total: event.total })
              }
              appendLog({ message: event.message, type: event.type })
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setFinal({
          ok: false,
          error: error instanceof Error ? error.message : "Не удалось запустить повторную синхронизацию заказов",
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function cancelRetry() {
    abortRef.current?.abort()
    setLoading(false)
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const failedOrders = final?.retried?.filter((item) => !item.success) || []

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
          <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>МойСклад: заказы</h2>
          <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>
            Кнопка заново выгрузит неотправленные заказы и обновит уже созданные заказы в МойСклад.
          </p>
        </div>
        <button
          type="button"
          onClick={loading ? cancelRetry : runRetry}
          style={{
            padding: "10px 16px",
            borderRadius: "999px",
            border: `1px solid ${loading ? "#999" : "#5b328a"}`,
            background: loading ? "#f3f3f3" : "#5b328a",
            color: loading ? "#333" : "#fff",
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Отмена" : "Повторить/обновить выгрузку заказов"}
        </button>
      </div>

      {loading && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
            <span>{progress.total > 0 ? `${progress.current} / ${progress.total}` : "Загрузка..."}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: "6px", background: "#e5e5e5", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: "#5b328a",
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            maxHeight: "200px",
            overflowY: "auto",
            padding: "10px",
            borderRadius: "8px",
            background: "#f9fafb",
            fontSize: "12px",
            fontFamily: "monospace",
            lineHeight: "1.6",
            color: "#333",
          }}
        >
          {log.map((entry, i) => (
            <div
              key={i}
              style={{
                color: entry.type === "error"
                  ? "#b91c1c"
                  : entry.type === "order_done"
                    ? "#166534"
                    : entry.type === "done"
                      ? "#1d4ed8"
                      : "#555",
              }}
            >
              {entry.message}
            </div>
          ))}
        </div>
      )}

      {final && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: final.ok ? "#f0fdf4" : "#fef2f2",
            color: final.ok ? "#166534" : "#991b1b",
            fontSize: "13px",
          }}
        >
          {final.ok ? (
            <span>
              Готово: проверено {final.checked || 0}, к выгрузке {final.retryable || 0}, отправлено{" "}
              {final.succeeded || 0}, ошибок {final.failed || 0}.
            </span>
          ) : (
            <div>
              <div>{final.error || "Повторная синхронизация завершилась с ошибками"}</div>
              <div style={{ marginTop: "6px" }}>
                Проверено {final.checked || 0}, к выгрузке {final.retryable || 0}, отправлено {final.succeeded || 0},
                ошибок {final.failed || 0}.
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
