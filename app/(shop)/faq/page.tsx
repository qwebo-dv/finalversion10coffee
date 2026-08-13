import type { Metadata } from "next"
import { ShopHeader } from "@/components/shop/shop-header"
import { getProductTypes, getShopProducts } from "@/lib/actions/products"
import { getPublishedFaqs } from "@/lib/actions/faqs"
import { FaqQuestionForm } from "@/components/shop/faq-question-form"

export const metadata: Metadata = {
  title: "Вопросы и ответы — 10coffee",
  description: "Ответы на частые вопросы о кофе, заказе, оплате и доставке 10coffee.",
}

export const dynamic = "force-dynamic"

export default async function FaqPage() {
  const [products, productTypes, questions] = await Promise.all([getShopProducts(), getProductTypes(), getPublishedFaqs()])
  return <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]"><ShopHeader products={products} productTypes={productTypes} /><article className="mx-auto max-w-5xl px-5 py-16 lg:px-10 lg:py-24"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#e6610d]">Помощь покупателю</p><h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Вопросы и ответы</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-[#6e655e]">Коротко отвечаем на основные вопросы о товарах, оформлении и получении заказа.</p><div className="mt-12 divide-y divide-black/[0.09] border-y border-black/[0.09]">{questions.map((item) => <details key={item.id} className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 text-xl font-black"><span>{item.question}</span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-8 pr-12 text-sm leading-7 text-[#554b43]">{item.answer}</p></details>)}{questions.length === 0 && <p className="py-7 text-sm leading-7 text-[#6e655e]">Скоро здесь появятся ответы на частые вопросы.</p>}</div><div className="mt-10 max-w-xl"><p className="text-sm text-[#6e655e]">Не нашли ответ? Оставьте вопрос — он попадёт на модерацию.</p><FaqQuestionForm /></div></article></main>
}
