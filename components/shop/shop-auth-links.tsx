"use client"

import { useRouter } from "next/navigation"

export function ShopAuthLinks() {
  const router = useRouter()

  function openAuth(view: "login" | "register") {
    const url = new URL(window.location.href)
    url.searchParams.set("auth", view)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => openAuth("login")}
          className="text-left text-sm font-semibold text-[#554b43] transition hover:text-[#5b328a]"
        >
          Войти в аккаунт
        </button>
      </li>
      <li>
        <button
          type="button"
          onClick={() => openAuth("register")}
          className="text-left text-sm font-semibold text-[#554b43] transition hover:text-[#5b328a]"
        >
          Регистрация
        </button>
      </li>
    </>
  )
}
