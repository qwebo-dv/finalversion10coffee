import type { Metadata } from "next"
import { ShopHeader } from "@/components/shop/shop-header"
import { getCachedShopProducts, getProductTypes } from "@/lib/actions/products"

export const metadata: Metadata = {
  title: "Возврат товаров и денежных средств — 10coffee",
  description: "Условия отказа от заказа, возврата товаров и денежных средств в интернет-магазине 10coffee.",
}

export const dynamic = "force-dynamic"

export default async function ReturnPage() {
  const [products, productTypes] = await Promise.all([getCachedShopProducts(), getProductTypes()])
  return <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]"><ShopHeader products={products} productTypes={productTypes} /><article className="mx-auto max-w-5xl px-5 py-16 lg:px-10 lg:py-24"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#e6610d]">Покупателям</p><h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Возврат и обмен</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#6e655e]">Если с заказом что-то не так, свяжитесь с нами — разберём ситуацию и подскажем порядок действий.</p><div className="mt-12 space-y-5">{[
    ["Отказ от заказа", "Вы можете отказаться от заказа до его передачи в доставку. После передачи применяются сроки и условия, установленные законодательством Российской Федерации."],
    ["Товар надлежащего качества", "Для возврата непродовольственного товара должны быть сохранены товарный вид, потребительские свойства, комплектность и подтверждение покупки. Для продовольственных товаров действуют предусмотренные законом ограничения."],
    ["Ненадлежащее качество или ошибка в заказе", "Сфотографируйте товар и упаковку сразу после получения и сообщите нам номер заказа. Мы проверим обращение и предложим замену, возврат стоимости или другое подходящее решение."],
    ["Возврат денежных средств", "После одобрения возврата деньги перечисляются тем же способом, которым был оплачен заказ, если стороны не согласовали другой способ. Срок зачисления зависит от банка."],
  ].map(([title, text]) => <section key={title} className="rounded-[28px] border border-black/[0.07] bg-white p-7 sm:p-9"><h2 className="text-2xl font-black">{title}</h2><p className="mt-4 text-sm leading-7 text-[#554b43]">{text}</p></section>)}</div><div className="mt-10 rounded-[28px] bg-[#5b328a] p-8 text-white"><h2 className="text-2xl font-black">Как обратиться</h2><p className="mt-3 text-sm leading-7 text-white/75">Напишите на <a className="font-black text-white" href="mailto:10coffee@mail.ru">10coffee@mail.ru</a> или позвоните по номеру <a className="font-black text-white" href="tel:+79384537060">+7 (938) 453-70-60</a>. Укажите номер заказа, товар и причину обращения.</p></div></article></main>
}
