import type { AppUser } from "@/lib/auth/types"

type AuthCallback = (_event: "INITIAL_SESSION", session: { user: AppUser | null } | null) => void

function getSessionScope() {
  const pathname = window.location.pathname
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "business"
  return pathname === "/shop"
    || pathname.startsWith("/shop/")
    || pathname === "/main"
    || pathname.startsWith("/main/")
    || pathname === "/checkout"
    || pathname === "/order"
    || pathname.startsWith("/order/")
    ? "individual"
    : "business"
}

function authHeaders() {
  return { "x-coffee-auth-scope": getSessionScope() }
}

async function fetchUser() {
  const res = await fetch("/api/auth/me", { cache: "no-store", headers: authHeaders() })
  if (!res.ok) throw new Error(`Auth request failed with HTTP ${res.status}`)
  const json = await res.json()
  return (json.user as AppUser | null) || null
}

type BrowserClient = ReturnType<typeof createBrowserClient>
let browserClient: BrowserClient | null = null

function createBrowserClient() {
  return {
    auth: {
      async getUser() {
        const user = await fetchUser()
        return { data: { user }, error: null }
      },
      onAuthStateChange(callback: AuthCallback) {
        void fetchUser().then((user) => callback("INITIAL_SESSION", user ? { user } : null))
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        }
      },
      async updateUser(params: { data?: Record<string, unknown>; password?: string }) {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(params),
        })
        const json = await res.json()
        return {
          data: { user: (json.user as AppUser | null) || null },
          error: res.ok ? null : { message: json.error || "Ошибка обновления пользователя" },
        }
      },
      async signOut() {
        await fetch("/api/auth/signout", { method: "POST", headers: authHeaders() })
        return { error: null }
      },
    },
  }
}

export function createClient() {
  browserClient ||= createBrowserClient()
  return browserClient
}
