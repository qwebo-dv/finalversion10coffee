"use client"

import { openAuthModal } from "@/components/auth/auth-modal-store"

export function ShopAuthLinks() {
  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => openAuthModal("login")}
          className="text-left text-sm font-semibold text-[#554b43] transition hover:text-[#5b328a]"
        >
          Войти в аккаунт
        </button>
      </li>
      <li>
        <button
          type="button"
          onClick={() => openAuthModal("register")}
          className="text-left text-sm font-semibold text-[#554b43] transition hover:text-[#5b328a]"
        >
          Регистрация
        </button>
      </li>
    </>
  )
}
