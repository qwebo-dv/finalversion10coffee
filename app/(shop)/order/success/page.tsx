import Link from "next/link"
import { refreshYooKassaOrderPayment } from "@/lib/payments/yookassa-order-status"

export const dynamic = "force-dynamic"

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const params = await searchParams
  const payment = params.orderId
    ? await refreshYooKassaOrderPayment(params.orderId, "order").catch(() => null)
    : null
  const paid = payment?.ok && payment.status === "paid"

  return <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5"><div className="max-w-lg rounded-[32px] bg-white p-10 text-center shadow-xl"><h1 className="text-3xl font-black">{paid ? "Оплата принята" : "Платёж проверяется"}</h1><p className="mt-3 text-sm text-[#756b63]">{paid ? `Заказ ${payment.orderNumber || ""} передан в обработку.` : "Статус платежа будет обновлён автоматически. Если деньги списаны, повторно оплачивать заказ не нужно."}</p><Link href="/shop" className="mt-7 inline-flex rounded-full bg-[#5b328a] px-6 py-3 text-sm font-bold text-white">Вернуться в магазин</Link></div></main>
}
