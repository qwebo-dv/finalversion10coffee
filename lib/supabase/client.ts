import type { AppUser } from "@/lib/auth/types"
import type { CustomerSessionScope } from "@/lib/auth/constants"

type AuthCallback = (_event: "INITIAL_SESSION", session: { user: AppUser | null } | null) => void

function getSessionScope(explicitScope?: CustomerSessionScope) {
  if (explicitScope) return explicitScope
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

function authHeaders(sessionScope?: CustomerSessionScope) {
  return { "x-coffee-auth-scope": getSessionScope(sessionScope) }
}

async function fetchUser(sessionScope?: CustomerSessionScope) {
  const res = await fetch("/api/auth/me", { cache: "no-store", headers: authHeaders(sessionScope) })
  if (!res.ok) throw new Error(`Auth request failed with HTTP ${res.status}`)
  const json = await res.json()
  return (json.user as AppUser | null) || null
}

type BrowserClient = ReturnType<typeof createBrowserClient>
const browserClients = new Map<CustomerSessionScope | "auto", BrowserClient>()

function createBrowserClient(sessionScope?: CustomerSessionScope) {
  return {
    auth: {
      async getUser() {
        const user = await fetchUser(sessionScope)
        return { data: { user }, error: null }
      },
      onAuthStateChange(callback: AuthCallback) {
        void fetchUser(sessionScope).then((user) => callback("INITIAL_SESSION", user ? { user } : null))
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        }
      },
      async updateUser(params: { data?: Record<string, unknown>; password?: string; currentPassword?: string }) {
        const res = await fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders(sessionScope) },
          body: JSON.stringify(params),
        })
        const json = await res.json()
        return {
          data: { user: (json.user as AppUser | null) || null },
          error: res.ok ? null : { message: json.error || "Ошибка обновления пользователя" },
        }
      },
      async signOut() {
        await fetch("/api/auth/signout", { method: "POST", headers: authHeaders(sessionScope) })
        return { error: null }
      },
    },
  }
}

export function createClient(sessionScope?: CustomerSessionScope) {
  const key = sessionScope || "auto"
  let browserClient = browserClients.get(key)
  if (!browserClient) {
    browserClient = createBrowserClient(sessionScope)
    browserClients.set(key, browserClient)
  }
  return browserClient
}
