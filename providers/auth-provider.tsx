"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CustomerSessionScope } from "@/lib/auth/constants"
import type { AppUser } from "@/lib/auth/types"

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  userType: "client" | "admin" | null
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  userType: null,
})

export function AuthProvider({ children, sessionScope }: { children: React.ReactNode; sessionScope?: CustomerSessionScope }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient(sessionScope)

  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data } = await supabase.auth.getUser()
          if (!cancelled) {
            setUser(data.user)
            setLoading(false)
          }
          return
        } catch (error) {
          console.error(`[auth] Не удалось загрузить сессию, попытка ${attempt}`, error)
          if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 200))
        }
      }
      if (!cancelled) setLoading(false)
    }
    void loadUser()
    return () => { cancelled = true }
  }, [supabase])

  const userType = user?.user_metadata?.user_type as
    | "client"
    | "admin"
    | null

  return (
    <AuthContext.Provider value={{ user, loading, userType }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
