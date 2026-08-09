import type { Metadata } from "next"
import "./payload-overrides.css"

export const metadata: Metadata = {
  title: {
    default: "10coffee — Оптовая платформа кофе и чая",
    template: "%s | 10coffee",
  },
  description:
    "B2B платформа для оптовой закупки кофе, чая и аксессуаров. Удобный личный кабинет для оптовых клиентов.",
  metadataBase: new URL("https://10coffee.ru"),
  openGraph: {
    title: "10coffee — Оптовая платформа кофе и чая",
    description:
      "B2B платформа для оптовой закупки кофе, чая и аксессуаров.",
    url: "https://10coffee.ru",
    siteName: "10coffee",
    locale: "ru_RU",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Root layout is minimal — each route group handles its own <html>/<body>
  // This prevents conflicts with Payload CMS which renders its own <html>
  return children
}
