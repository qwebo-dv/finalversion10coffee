"use client"

import { useEffect, useState } from "react"
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
import {
  openAuthModal,
  closeAuthModal,
  useAuthModalStore,
  type AuthView,
} from "./auth-modal-store"

interface AuthModalProps {
  announcement?: string | null
}

export function AuthModal({ announcement }: AuthModalProps) {
  const { open, view } = useAuthModalStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return
    setInitialized(true)
    const params = new URLSearchParams(window.location.search)
    const auth = params.get("auth") as AuthView | null
    if (auth === "login" || auth === "register" || auth === "forgot") {
      openAuthModal(auth)
    }
  }, [initialized])

  function switchView(nextView: AuthView) {
    openAuthModal(nextView)
  }

  function handleClose() {
    closeAuthModal()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl border-0 p-6 gap-0 shadow-2xl">
        <VisuallyHidden>
          <DialogTitle>
            {view === "register" ? "Регистрация" : view === "forgot" ? "Восстановление пароля" : "Вход"}
          </DialogTitle>
        </VisuallyHidden>

        {/* Announcement from admin */}
        {announcement && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#faead5] border border-[#e6610d]/20 px-4 py-3 mb-5">
            <Info className="h-4 w-4 text-[#e6610d] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#2d1b11] leading-relaxed">{announcement}</p>
          </div>
        )}

        {view === "login" && (
          <LoginForm
            onSwitchToRegister={() => switchView("register")}
            onSwitchToForgot={() => switchView("forgot")}
          />
        )}
        {view === "register" && (
          <RegisterForm onSwitchToLogin={() => switchView("login")} />
        )}
        {view === "forgot" && (
          <ForgotPasswordForm onSwitchToLogin={() => switchView("login")} />
        )}
      </DialogContent>
    </Dialog>
  )
}
