import type { Metadata } from "next"
import { ShopHeader } from "@/components/shop/shop-header"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"

export const metadata: Metadata = {
  title: "Вопросы и ответы — 10coffee",
  description: "Ответы на частые вопросы о кофе, заказе, оплате и доставке 10coffee.",
}

export const dynamic = "force-dynamic"

const questions = [
  ["Когда обжаривается кофе?", "Кофе обжаривается небольшими партиями и отправляется максимально свежим. Дата обжарки указана на упаковке."],
  ["Можно заказать помол?", "Да. Если для выбранного товара доступен помол, его можно выбрать вместе с фасовкой в карточке товара."],
  ["Нужна ли регистрация?", "Нет, заказ можно оформить без регистрации. Личный кабинет сохраняет историю заказов, избранное и данные для доставки."],
  ["Какие способы оплаты доступны?", "Доступные способы показываются при оформлении. Онлайн-оплата проходит через защищённую платёжную страницу банка."],
  ["Как получить заказ?", "Доступны СДЭК, доставка по Сочи и бесплатный самовывоз с ул. Пластунской, 79/1 после уведомления о готовности."],
  ["Как узнать статус заказа?", "После оформления мы отправляем подтверждение. Зарегистрированные покупатели также видят статус в личном кабинете."],
  ["Что делать при повреждении упаковки?", "Зафиксируйте повреждение при получении, сфотографируйте товар и сразу свяжитесь с нами, указав номер заказа."],
]

export default async function FaqPage() {
  const [products, productTypes] = await Promise.all([getShopProducts(), getProductTypes()])
  return <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]"><ShopHeader products={products} productTypes={productTypes} /><article className="mx-auto max-w-5xl px-5 py-16 lg:px-10 lg:py-24"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#e6610d]">Помощь покупателю</p><h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Вопросы и ответы</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#6e655e]">Коротко отвечаем на основные вопросы о товарах, оформлении и получении заказа.</p><div className="mt-12 divide-y divide-black/[0.09] border-y border-black/[0.09]">{questions.map(([question, answer]) => <details key={question} className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 text-xl font-black"><span>{question}</span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-8 pr-12 text-sm leading-7 text-[#554b43]">{answer}</p></details>)}</div><p className="mt-10 text-sm text-[#6e655e]">Не нашли ответ? Напишите на <a href="mailto:10coffee@mail.ru" className="font-black text-[#5b328a]">10coffee@mail.ru</a>.</p></article></main>
}
