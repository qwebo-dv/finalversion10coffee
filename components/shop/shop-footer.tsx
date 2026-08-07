import Link from "next/link"
import { Mail, MapPin, Phone } from "lucide-react"
import { ShopAuthLinks } from "./shop-auth-links"

const CATALOG_LINKS = [
  { label: "Кофе", href: "/shop?type=kofe" },
  { label: "Чай", href: "/shop?type=chay" },
  { label: "Аксессуары", href: "/shop?type=aksessuary" },
  { label: "Весь каталог", href: "/shop" },
]

const COMPANY_LINKS = [
  { label: "О нас", href: "/o-nas" },
  { label: "Контакты", href: "/kontakty" },
  { label: "Блог", href: "/blog" },
  { label: "Обучение бариста", href: "/obuchenie" },
  { label: "Оптовым клиентам", href: "/b2b-servis" },
]

const CUSTOMER_LINKS = [
  { label: "Оформить заказ", href: "/checkout" },
  { label: "Напишите нам", href: "mailto:10coffee@mail.ru" },
]

export function ShopFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-[#f3eee9]">
      <div className="mx-auto grid max-w-[1480px] gap-12 px-5 py-16 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-10">
        {/* Brand */}
        <div>
          <Link href="/shop" className="text-3xl font-black tracking-[-0.08em] text-[#5b328a]">10COFFEE</Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-[#6e655e]">Свежеобжаренный кофе, чай и аксессуары с доставкой по всей России. Обжариваем на ростерах Loring и отправляем в день заказа.</p>
          <div className="mt-6 space-y-2.5 text-sm text-[#554b43]">
            <p className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-[#e6610d]" /><a href="tel:+79384537060" className="hover:text-[#5b328a]">+7 (938) 453-70-60</a></p>
            <p className="flex items-center gap-2.5 pl-[26px]"><a href="tel:+79184017060" className="hover:text-[#5b328a]">+7 (918) 401-70-60</a></p>
            <p className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-[#e6610d]" /><a href="mailto:10coffee@mail.ru" className="hover:text-[#5b328a]">10coffee@mail.ru</a></p>
            <p className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-[#e6610d]" /><span>г. Сочи, ул. Пластунская 79/1</span></p>
          </div>
        </div>

        {/* Catalog */}
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#91867d]">Каталог</p>
          <ul className="mt-5 space-y-3 text-sm font-semibold text-[#554b43]">
            {CATALOG_LINKS.map((link) => <li key={link.href}><Link href={link.href} className="transition hover:text-[#5b328a]">{link.label}</Link></li>)}
          </ul>
        </div>

        {/* Company */}
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#91867d]">Компания</p>
          <ul className="mt-5 space-y-3 text-sm font-semibold text-[#554b43]">
            {COMPANY_LINKS.map((link) => <li key={link.href}><Link href={link.href} className="transition hover:text-[#5b328a]">{link.label}</Link></li>)}
          </ul>
        </div>

        {/* Customers */}
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#91867d]">Покупателям</p>
          <ul className="mt-5 space-y-3 text-sm font-semibold text-[#554b43]">
            <ShopAuthLinks />
            {CUSTOMER_LINKS.map((link) => <li key={link.href}><Link href={link.href} className="transition hover:text-[#5b328a]">{link.label}</Link></li>)}
          </ul>
          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#91867d]">Часы работы</p>
            <p className="mt-3 text-sm text-[#6e655e]">Пн–Пт: 9:00 – 18:00<br />Сб–Вс: выходные</p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-black/[0.06] bg-[#ece6e0]">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-[#8d827a] lg:px-10">
          <p>© 2026 10coffee. Все права защищены</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="https://vk.com/10coffee" target="_blank" rel="noopener noreferrer" className="font-bold transition hover:text-[#5b328a]">ВКонтакте</a>
            <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer" className="transition hover:text-[#5b328a]">Конфиденциальность</a>
            <a href="/Политика обработки персональных данных пользователей сайта.pdf" target="_blank" rel="noopener noreferrer" className="transition hover:text-[#5b328a]">Обработка данных</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
