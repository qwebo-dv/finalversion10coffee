"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { LoginForm } from "./login-form"
import { RegisterForm } from "./register-form"
import { ForgotPasswordForm } from "./forgot-password-form"
import { Info } from "lucide-react"

type AuthView = "login" | "register" | "forgot"

interface AuthModalProps {
  announcement?: string | null
}

export function AuthModal({ announcement }: AuthModalProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const authParam = searchParams.get("auth") as AuthView | null
  const urlOpen = authParam === "login" || authParam === "register" || authParam === "forgot"

  const [closedAuthParam, setClosedAuthParam] = useState<AuthView | null>(null)
  const activeView = authParam ?? "login"
  const open = urlOpen && closedAuthParam !== authParam

  function switchView(view: AuthView) {
    setClosedAuthParam(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set("auth", view)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleClose() {
    setClosedAuthParam(authParam)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("auth")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl border-0 p-6 gap-0 shadow-2xl">
        <VisuallyHidden>
          <DialogTitle>
            {activeView === "register" ? "Регистрация" : activeView === "forgot" ? "Восстановление пароля" : "Вход"}
          </DialogTitle>
        </VisuallyHidden>

        {/* Announcement from admin */}
        {announcement && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#faead5] border border-[#e6610d]/20 px-4 py-3 mb-5">
            <Info className="h-4 w-4 text-[#e6610d] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#2d1b11] leading-relaxed">{announcement}</p>
          </div>
        )}

        {activeView === "login" && (
          <LoginForm
            onSwitchToRegister={() => switchView("register")}
            onSwitchToForgot={() => switchView("forgot")}
          />
        )}
        {activeView === "register" && (
          <RegisterForm onSwitchToLogin={() => switchView("login")} />
        )}
        {activeView === "forgot" && (
          <ForgotPasswordForm onSwitchToLogin={() => switchView("login")} />
        )}
      </DialogContent>
    </Dialog>
  )
}
