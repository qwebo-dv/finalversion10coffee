"use client"

import { useState } from "react"
import Image from "next/image"
import { MessageCircle, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { FaTelegram } from "react-icons/fa"

const TELEGRAM_URL = "https://t.me/Tencoffeesochi"
const MAX_URL = "https://max.ru/u/f9LHodD0cOKa1C5S0VRomlqqlvMnh7CX7AaTfiG3sTv28xhc-4miAZFMuj4"

export function ContactWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-7 sm:right-6">
      {isOpen && (
        <div className="w-56 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-2 shadow-[0_18px_55px_rgba(29,29,27,0.18)]">
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#1d1d1b] transition hover:bg-[#e8f4fd]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2AABEE] text-white">
              <FaTelegram className="h-7 w-7" aria-hidden="true" />
            </span>
            <span>Telegram</span>
          </a>
          <a
            href={MAX_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsOpen(false)}
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#1d1d1b] transition hover:bg-[#f1edff]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center">
              <Image src="/icons/max.svg" alt="" width={28} height={28} className="h-9 w-9" />
            </span>
            <span>MAX</span>
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Закрыть способы связи" : "Написать нам"}
        className="flex min-h-12 items-center gap-2 rounded-full bg-[#5b328a] px-4 py-3 text-sm font-black text-white shadow-[0_14px_34px_rgba(91,50,138,0.3)] transition hover:bg-[#4a2870] focus:outline-none focus:ring-2 focus:ring-[#5b328a] focus:ring-offset-2"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span>Написать нам</span>
      </button>
    </div>
  )
}
