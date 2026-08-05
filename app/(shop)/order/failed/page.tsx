import Link from "next/link"

export default function PaymentFailedPage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#f8f5f1] px-5"><div className="max-w-lg rounded-[32px] bg-white p-10 text-center shadow-xl"><h1 className="text-3xl font-black">Оплата не завершена</h1><p className="mt-3 text-sm text-[#756b63]">Заказ сохранён. Вы сможете повторить оплату после подключения платёжного шлюза.</p><Link href="/shop" className="mt-7 inline-flex rounded-full bg-[#5b328a] px-6 py-3 text-sm font-bold text-white">Вернуться в магазин</Link></div></main>
}
