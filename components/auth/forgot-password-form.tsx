"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { resetPassword } from "@/lib/actions/auth"
import { forgotPasswordSchema } from "@/lib/utils/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Loader2, ArrowLeft, Mail } from "lucide-react"

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void
}

export function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const form = useForm<{ email: string }>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(data: { email: string }) {
    setError(null)
    setLoading(true)
    try {
      const result = await resetPassword(data)
      if (result?.error) setError(result.error)
      else setSuccess(true)
    } catch {
      setError("Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-5 text-center py-4">
        <Mail className="h-14 w-14 text-[#5b328a] mx-auto" />
        <h2 className="text-[18px] font-black text-neutral-900">Проверьте почту</h2>
        <p className="text-[12px] text-neutral-500 max-w-sm mx-auto leading-relaxed">
          Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля.
        </p>
        <Button onClick={onSwitchToLogin} variant="outline" className="rounded-xl font-bold">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Вернуться к входу
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-black text-neutral-900 tracking-tight">Восстановление пароля</h2>
        <p className="text-[12px] text-neutral-400 mt-1">Введите email от вашего аккаунта</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-[12px] text-red-600 font-medium">
          {error}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-semibold text-neutral-600">Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="your@email.com" autoComplete="email" className="h-11 rounded-xl" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="consent"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#5b328a] w-4 h-4 shrink-0"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Принимаю{" "}
              <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                политику конфиденциальности
              </a>{" "}
              и{" "}
              <a href="/Политика обработки персональных данных пользователей сайта.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                правила обработки персональных данных
              </a>
            </span>
          </label>

          <Button type="submit" className="w-full h-11 rounded-xl font-bold" disabled={loading || !agreed}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Отправить ссылку
          </Button>
        </form>
      </Form>

      <p className="text-center text-[12px]">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-neutral-400 hover:text-neutral-900 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Вернуться к входу
        </button>
      </p>
    </div>
  )
}
