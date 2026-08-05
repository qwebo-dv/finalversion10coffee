import type { Metadata } from "next"
import { HtmlWrapper } from "@/components/shared/html-wrapper"
import { GuestCartProvider } from "@/providers/guest-cart-provider"

export const metadata: Metadata = {
  title: "Магазин кофе — 10coffee",
  description: "Розничный интернет-магазин кофе, чая и аксессуаров 10coffee.",
  metadataBase: new URL("https://shop.10coffee.ru"),
  robots: { index: false, follow: false, nocache: true },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <HtmlWrapper>
      <GuestCartProvider>{children}</GuestCartProvider>
    </HtmlWrapper>
  )
}
