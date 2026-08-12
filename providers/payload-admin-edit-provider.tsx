"use client"

import { createContext, useContext, useEffect, useState } from "react"

const CONTENT_ROLES = new Set(["admin", "manager", "super_admin", "content_manager"])

interface PayloadAdminEditContextValue {
  canEditProducts: boolean
}

const PayloadAdminEditContext = createContext<PayloadAdminEditContextValue>({ canEditProducts: false })

export function PayloadAdminEditProvider({ children }: { children: React.ReactNode }) {
  const [canEditProducts, setCanEditProducts] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/admins/me", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result: { user?: { collection?: string; role?: string } } | null) => {
        const user = result?.user
        setCanEditProducts(Boolean(user?.collection === "admins" && user.role && CONTENT_ROLES.has(user.role)))
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return
        setCanEditProducts(false)
      })

    return () => controller.abort()
  }, [])

  return <PayloadAdminEditContext.Provider value={{ canEditProducts }}>{children}</PayloadAdminEditContext.Provider>
}

export function usePayloadAdminEdit() {
  return useContext(PayloadAdminEditContext)
}
