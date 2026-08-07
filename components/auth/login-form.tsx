"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "@/lib/actions/auth"
import { loginSchema, type LoginFormData } from "@/lib/utils/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Loader2 } from "lucide-react"
import { SocialAuthButtons } from "./social-auth-buttons"

interface LoginFormProps {
  onSwitchToRegister: () => void
  onSwitchToForgot: () => void
}

export function LoginForm({ onSwitchToRegister, onSwitchToForgot }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(data: LoginFormData) {
    setError(null)
    setLoading(true)
    try {
      const result = await signIn(data)
      if (result?.error) setError(result.error)
    } catch {
      // redirect throws, which is expected
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[20px] font-black text-neutral-900 tracking-tight">Вход в кабинет</h2>
        <p className="text-[12px] text-neutral-400 mt-1">Введите ваш email и пароль</p>
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

          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[12px] font-semibold text-neutral-600">Пароль</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Введите пароль" autoComplete="current-password" className="h-11 rounded-xl" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
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
            Войти
          </Button>
        </form>
      </Form>

      <SocialAuthButtons />

      <div className="flex flex-col gap-2 text-center text-[12px]">
        <button
          type="button"
          onClick={onSwitchToForgot}
          className="text-neutral-400 hover:text-neutral-900 transition-colors"
        >
          Забыли пароль?
        </button>
        <p className="text-neutral-400">
          Нет аккаунта?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-[#5b328a] font-semibold hover:text-[#4a2870] transition-colors"
          >
            Зарегистрироваться
          </button>
        </p>
      </div>
    </div>
  )
}
