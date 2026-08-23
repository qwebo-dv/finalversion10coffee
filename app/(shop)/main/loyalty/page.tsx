"use client"

import { useEffect, useState } from "react"
import { BadgePercent, Loader2 } from "lucide-react"
import { getMyLoyalty, type MyLoyaltyData } from "@/lib/actions/loyalty"
import { LoyaltyProgramDescription } from "@/components/shop/loyalty-program-description"

const typeLabel: Record<string, string> = {
  accrual: "Начисление",
  reservation: "Резерв",
  redemption: "Списание",
  release: "Снятие резерва",
  refund: "Возврат",
  reversal: "Аннулирование",
  expiry: "Сгорание",
}

const statusLabel: Record<string, string> = {
  pending: "Ожидает оплаты",
  active: "Активна",
  released: "Освобождена",
  reversed: "Аннулирована",
  expired: "Сгорела",
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value)) : "—"
}

export default function LoyaltyPage() {
  const [data, setData] = useState<MyLoyaltyData | null>(null)

  useEffect(() => {
    void getMyLoyalty().then(setData).catch(() => setData(null))
  }, [])

  if (!data) return <div className="flex min-h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#5b328a]" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-black tracking-tight text-neutral-900">Мои бонусы</h1>
        <p className="mt-1 text-[12px] text-neutral-400">Баллы равны рублям и начисляются после доставки заказа.</p>
      </div>

      <section className="rounded-3xl bg-[#5b328a] p-6 text-white shadow-[0_12px_35px_rgba(91,50,138,.18)] sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-sm text-white/70">Доступно к списанию</p>
            <p className="mt-2 text-4xl font-black">{data.available.toLocaleString("ru-RU")} Б</p>
          </div>
          <BadgePercent className="h-9 w-9 text-white/75" />
        </div>
        <div className="mt-6 grid gap-3 border-t border-white/15 pt-5 text-sm sm:grid-cols-2">
          <p className="text-white/75">Всего баллов: <span className="font-bold text-white">{data.balance.toLocaleString("ru-RU")} Б</span></p>
          <p className="text-white/75">Срок действия: <span className="font-bold text-white">{formatDate(data.expiresAt)}</span></p>
        </div>
      </section>

      <LoyaltyProgramDescription rules={{ tiers: data.tiers, maxRedemptionPercent: data.maxRedemptionPercent, expiryDays: data.expiryDays }} />

      <section className="overflow-hidden rounded-3xl border border-neutral-100 bg-white">
        <div className="border-b border-neutral-100 px-5 py-5 sm:px-6"><h2 className="text-base font-black text-neutral-900">История операций</h2></div>
        {data.operations.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">Операций пока нет.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {data.operations.map((operation) => <div key={operation.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900">{typeLabel[operation.type] || operation.type}</p>
                <p className="mt-1 truncate text-xs text-neutral-400">{operation.orderNumber ? `Заказ ${operation.orderNumber} · ` : ""}{formatDate(operation.createdAt)} · {statusLabel[operation.status] || operation.status}</p>
                {operation.note && <p className="mt-1 text-xs text-neutral-500">{operation.note}</p>}
              </div>
              <strong className={operation.amount >= 0 ? "shrink-0 text-sm text-emerald-600" : "shrink-0 text-sm text-neutral-900"}>{operation.amount >= 0 ? "+" : ""}{operation.amount.toLocaleString("ru-RU")} Б</strong>
            </div>)}
          </div>
        )}
      </section>
    </div>
  )
}
