"use client"

import Link from "next/link"
import { ArrowRight, Coffee, FlaskConical, Leaf, PackageCheck, Quote, ShieldCheck, Sparkles, Truck } from "lucide-react"
import { ShopHeader } from "./shop-header"
import { ShopProductCard } from "./shop-catalog"
import type { Product, ProductTypeOption } from "@/types"

const CATEGORY_STYLES = [
  "bg-[#f0d8bf]",
  "bg-[#dfe6cb]",
  "bg-[#e3d8ec]",
  "bg-[#d8e4e6]",
]

const CATEGORY_ICONS = [Coffee, Leaf, Sparkles, FlaskConical]

const FAQ = [
  {
    question: "Когда обжаривается кофе?",
    answer: "Мы обжариваем кофе небольшими партиями и отправляем максимально свежим. Дата обжарки указывается на упаковке.",
  },
  {
    question: "Можно заказать кофе уже молотым?",
    answer: "Да. Если у товара доступен помол, выберите подходящий вариант прямо в карточке перед добавлением в корзину.",
  },
  {
    question: "Как доставляются заказы?",
    answer: "По России отправляем СДЭК, по Сочи доступна городская доставка, также заказ можно бесплатно забрать самостоятельно.",
  },
  {
    question: "Можно оформить заказ без регистрации?",
    answer: "Да, регистрация необязательна. Она нужна только для истории заказов, избранного и более быстрого оформления следующих покупок.",
  },
  {
    question: "Что делать, если товар не подошёл?",
    answer: "Напишите нам на 10coffee@mail.ru и укажите номер заказа. Мы разберём обращение и подскажем порядок возврата.",
  },
]

export function ShopHome({ products, productTypes }: { products: Product[]; productTypes: ProductTypeOption[] }) {
  const visibleTypes = productTypes
    .filter((type) => !["sluzhebnoe", "oprihodovanie-i-to"].includes(type.slug))
    .slice(0, 4)
  const popular = [...products]
    .sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 4)
  const newest = [...products]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 4)
  const reviews = products
    .flatMap((product) => (product.reviews || []).map((review) => ({ ...review, productName: product.name })))
    .filter((review) => review.comment && review.status !== "rejected" && review.status !== "pending")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)
  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#1d1d1b]">
      <ShopHeader products={products} productTypes={productTypes} />

      <section className="mx-auto max-w-[1480px] px-5 pb-16 pt-8 lg:px-10 lg:pb-24 lg:pt-12">
        <div className="relative overflow-hidden rounded-[36px] bg-[#21180f] px-7 py-10 text-white sm:px-12 sm:py-14 lg:min-h-[590px] lg:px-16 lg:py-16">
          <div className="absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-[#5b328a]/45 blur-3xl" />
          <div className="absolute -bottom-48 right-[24%] h-[420px] w-[420px] rounded-full bg-[#e6610d]/30 blur-3xl" />
          <div className="absolute bottom-10 right-10 top-10 hidden w-[36%] items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-2xl lg:flex">
            <div className="absolute -right-16 top-10 h-48 w-48 rounded-full border-[34px] border-[#e6610d]/55" />
            <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full border-[28px] border-[#5b328a]/70" />
            <div className="relative flex h-[310px] w-[235px] rotate-3 flex-col justify-between rounded-[24px] bg-[#f1e8de] p-8 text-[#21180f] shadow-[0_35px_80px_rgba(0,0,0,0.35)]">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]">10coffee</p>
              <div><p className="text-7xl font-black tracking-[-0.08em]">10</p><p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#e6610d]">Свежая обжарка</p></div>
              <p className="text-xs font-bold leading-5 text-[#766d66]">Кофе, который легко выбрать и приятно пить каждый день.</p>
            </div>
          </div>
          <div className="relative z-10 flex min-h-[440px] max-w-3xl flex-col justify-center">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#f58a42]">Свежий кофе каждый день</p>
            <h1 className="mt-5 text-5xl font-black leading-[0.94] tracking-[-0.065em] sm:text-7xl lg:text-[86px]">Найдите кофе под свой вкус, а не под сложные термины</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg">Обжариваем на ростерах Loring, помогаем выбрать сорт и отправляем свежий кофе по всей России.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/kofe" className="flex h-14 items-center gap-2 rounded-full bg-[#e6610d] px-7 text-sm font-black transition hover:bg-[#f06d16]">Выбрать кофе <ArrowRight className="h-4 w-4" /></Link>
              <Link href="#categories" className="flex h-14 items-center rounded-full border border-white/20 px-7 text-sm font-black transition hover:bg-white/10">Смотреть категории</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto max-w-[1480px] scroll-mt-28 px-5 pb-24 lg:px-10">
        <SectionHeading eyebrow="Каталог" title="Выберите свою категорию" href="/kofe" linkLabel="Перейти к кофе" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTypes.map((type, index) => {
            const Icon = CATEGORY_ICONS[index] || Coffee
            return (
              <Link key={type.id} href={`/${type.slug}`} className={`group relative min-h-[330px] overflow-hidden rounded-[30px] p-7 ${CATEGORY_STYLES[index] || CATEGORY_STYLES[0]}`}>
                <Icon className="absolute -bottom-4 -right-4 h-44 w-44 text-[#1d1d1b]/10 transition duration-500 group-hover:rotate-6 group-hover:scale-110" />
                <div className="relative z-10 flex h-full min-h-[276px] flex-col justify-between text-[#1d1d1b]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-[#1d1d1b]"><Icon className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-bold text-[#1d1d1b]/55">{type.product_count} товаров</p>
                    <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">{type.name}</h2>
                    <span className="mt-4 flex items-center gap-2 text-sm font-black">Смотреть <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {popular.length > 0 && (
        <section className="mx-auto max-w-[1480px] px-5 pb-24 lg:px-10">
          <SectionHeading eyebrow="Выбор покупателей" title="Популярные товары" href="/kofe?coll=popular" linkLabel="Смотреть все" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{popular.map((product) => <ShopProductCard key={product.id} product={product} />)}</div>
        </section>
      )}

      {newest.length > 0 && (
        <section className="bg-[#eee7df] py-24">
          <div className="mx-auto max-w-[1480px] px-5 lg:px-10">
            <SectionHeading eyebrow="Недавно в каталоге" title="Новинки" href="/kofe?coll=new" linkLabel="Все новинки" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{newest.map((product) => <ShopProductCard key={product.id} product={product} />)}</div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1480px] px-5 py-24 lg:px-10">
        <SectionHeading eyebrow="От заказа до чашки" title="Как мы работаем" />
        <div className="mt-9 grid gap-px overflow-hidden rounded-[30px] bg-black/[0.08] md:grid-cols-4">
          {[
            { icon: Coffee, number: "01", title: "Вы выбираете", text: "Сорт, фасовку и нужный помол прямо в карточке товара." },
            { icon: PackageCheck, number: "02", title: "Мы готовим", text: "Комплектуем заказ и бережно упаковываем каждую позицию." },
            { icon: Truck, number: "03", title: "Отправляем", text: "Передаём заказ в доставку по России или готовим к самовывозу." },
            { icon: ShieldCheck, number: "04", title: "Всегда на связи", text: "Помогаем с выбором и решаем вопросы после получения заказа." },
          ].map((step) => (
            <div key={step.number} className="bg-white p-8 lg:p-10">
              <div className="flex items-center justify-between"><step.icon className="h-7 w-7 text-[#e6610d]" /><span className="text-xs font-black text-[#b7ada5]">{step.number}</span></div>
              <h3 className="mt-12 text-2xl font-black tracking-[-0.03em]">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#6e655e]">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="bg-[#5b328a] py-24 text-white">
          <div className="mx-auto max-w-[1480px] px-5 lg:px-10">
            <SectionHeading eyebrow="Проверено покупателями" title="Отзывы наших клиентов" light />
            <div className="mt-9 grid gap-5 lg:grid-cols-3">
              {reviews.map((review) => (
                <article key={review.id} className="flex min-h-[280px] flex-col rounded-[28px] bg-white/10 p-7 ring-1 ring-white/15">
                  <Quote className="h-8 w-8 text-[#f58a42]" />
                  <p className="mt-6 text-lg font-semibold leading-8">{review.comment}</p>
                  <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                    <div><p className="font-black">{review.author_name || "Покупатель 10coffee"}</p><p className="mt-1 text-xs text-white/60">{review.productName}</p></div>
                    <p className="text-sm font-black text-[#ffd166]">{"★".repeat(Math.round(review.rating || 5))}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="faq" className="mx-auto grid max-w-[1480px] gap-10 px-5 py-24 lg:grid-cols-[0.65fr_1.35fr] lg:px-10">
        <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#e6610d]">Помощь покупателю</p><h2 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Частые вопросы</h2><p className="mt-5 max-w-sm text-base leading-7 text-[#6e655e]">Не нашли ответ? Напишите нам — поможем выбрать товар и уточнить детали заказа.</p><a href="mailto:10coffee@mail.ru" className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#5b328a]">Задать вопрос <ArrowRight className="h-4 w-4" /></a></div>
        <div className="divide-y divide-black/[0.09] border-y border-black/[0.09]">
          {FAQ.map((item) => <details key={item.question} className="group py-1"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 text-lg font-black"><span>{item.question}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xl transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pb-7 pr-12 text-sm leading-7 text-[#6e655e]">{item.answer}</p></details>)}
        </div>
      </section>
    </main>
  )
}

function SectionHeading({ eyebrow, title, href, linkLabel, light = false }: { eyebrow: string; title: string; href?: string; linkLabel?: string; light?: boolean }) {
  return <div className="flex items-end justify-between gap-6"><div><p className={`text-xs font-black uppercase tracking-[0.22em] ${light ? "text-[#f5aa76]" : "text-[#e6610d]"}`}>{eyebrow}</p><h2 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{title}</h2></div>{href && <Link href={href} className={`hidden items-center gap-2 text-sm font-black sm:flex ${light ? "text-white" : "text-[#5b328a]"}`}>{linkLabel}<ArrowRight className="h-4 w-4" /></Link>}</div>
}
