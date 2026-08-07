"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  ShoppingBag,
  Building2,
  Newspaper,
  Settings,
  GraduationCap,
  ExternalLink,
} from "lucide-react"

const navItems = [
  { title: "КАТАЛОГ", href: "/dashboard/catalog", icon: LayoutGrid },
  { title: "ЗАКАЗЫ", href: "/dashboard/orders", icon: ShoppingBag },
  { title: "МОИ КОМПАНИИ", href: "/dashboard/companies", icon: Building2 },
  { title: "НОВОСТИ", href: "/dashboard/news", icon: Newspaper },
  { title: "НАСТРОЙКИ", href: "/dashboard/settings", icon: Settings },
  { title: "ОБУЧЕНИЕ", href: "/obuchenie", icon: GraduationCap, external: true },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const isIndividual = user?.user_metadata?.customer_type === "individual"

  const items = isIndividual
    ? navItems.filter((item) => item.href === "/dashboard/orders" || item.href === "/dashboard/settings")
    : navItems

  return (
    <aside className="hidden md:flex w-[200px] flex-col border-r border-gray-200 bg-white shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-200">
        <Link href="/dashboard" className="block">
          <span className="text-xl font-black tracking-tight text-black">
            10COFFEE
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] font-semibold tracking-wide transition-colors",
                isActive
                  ? "bg-gray-100 text-black"
                  : "text-gray-500 hover:text-black hover:bg-gray-50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
              {item.external && (
                <ExternalLink className="h-3 w-3 ml-auto text-gray-400" />
              )}
            </Link>
          )
        })}
        {isIndividual && (
          <Link
            href="/shop"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] font-semibold tracking-wide text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
          >
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span>ИНТЕРНЕТ-МАГАЗИН</span>
          </Link>
        )}
      </nav>
    </aside>
  )
}
