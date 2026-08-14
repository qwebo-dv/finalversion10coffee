"use client"

import { useAuth, usePreferences } from "@payloadcms/ui"
import { BriefcaseBusiness, Layers3, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import "./AdminWorkspaceSwitcher.scss"

type Workspace = "wholesale" | "retail" | "all"

interface WorkspaceAdmin {
  role?: string | null
  canAccessWholesale?: boolean | null
  canAccessRetail?: boolean | null
}

const COOKIE_NAME = "coffee_admin_workspace"
const FULL_ACCESS_ROLES = new Set(["admin", "manager", "super_admin"])
const ORDERS_PREFERENCE_KEY = "admin-unread-orders-seen-at"
const FAQS_PREFERENCE_KEY = "admin-unread-faqs-seen-at"

interface UnreadCounts {
  orders: number
  faqs: number
}

function getCookie(name: string) {
  const prefix = `${name}=`
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : null
}

export default function AdminWorkspaceSwitcher() {
  const { user } = useAuth()
  const { getPreference, setPreference } = usePreferences()
  const pathname = usePathname()
  const admin = user as WorkspaceAdmin | null
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [seenAt, setSeenAt] = useState<{ orders: string | null; faqs: string | null }>({ orders: null, faqs: null })
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ orders: 0, faqs: 0 })
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(() => {
    if (typeof document === "undefined") return "all"
    const stored = getCookie(COOKIE_NAME)
    return stored === "wholesale" || stored === "retail" || stored === "all" ? stored : "all"
  })

  const allowed = useMemo(() => {
    const hasFullAccess = FULL_ACCESS_ROLES.has(admin?.role || "")
    return {
      wholesale: hasFullAccess || admin?.role === "wholesale_manager" || Boolean(admin?.canAccessWholesale),
      retail: hasFullAccess || admin?.role === "retail_manager" || Boolean(admin?.canAccessRetail),
    }
  }, [admin])
  const canManageContent = FULL_ACCESS_ROLES.has(admin?.role || "") || admin?.role === "content_manager"
  const canReadOrders = allowed.wholesale || allowed.retail

  const workspace: Workspace = selectedWorkspace === "wholesale" && allowed.wholesale
    ? "wholesale"
    : selectedWorkspace === "retail" && allowed.retail
      ? "retail"
      : allowed.wholesale && allowed.retail
        ? "all"
        : allowed.wholesale
          ? "wholesale"
          : "retail"

  function selectWorkspace(next: Workspace) {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(next)}; path=/; max-age=31536000; SameSite=Lax`
    setSelectedWorkspace(next)
    window.location.reload()
  }

  useEffect(() => {
    let active = true

    async function loadPreferences() {
      try {
        const [orders, faqs] = await Promise.all([
          getPreference<string | null>(ORDERS_PREFERENCE_KEY),
          getPreference<string | null>(FAQS_PREFERENCE_KEY),
        ])
        if (active) setSeenAt({ orders: orders || null, faqs: faqs || null })
      } catch {
        // An unavailable preferences store must not prevent administration.
      } finally {
        if (active) setPreferencesReady(true)
      }
    }

    void loadPreferences()
    return () => { active = false }
  }, [getPreference])

  useEffect(() => {
    if (!preferencesReady) return

    const viewed = pathname?.startsWith("/admin/collections/orders")
      ? "orders"
      : pathname?.startsWith("/admin/collections/faqs")
        ? "faqs"
        : null
    if (!viewed) return

    const value = new Date().toISOString()
    const preferenceKey = viewed === "orders" ? ORDERS_PREFERENCE_KEY : FAQS_PREFERENCE_KEY
    setSeenAt((current) => ({ ...current, [viewed]: value }))
    setUnreadCounts((current) => ({ ...current, [viewed]: 0 }))
    void setPreference(preferenceKey, value).catch(() => {
      // The current screen remains available even when saving the read marker fails.
    })
  }, [pathname, preferencesReady, setPreference])

  useEffect(() => {
    if (!preferencesReady || (!canReadOrders && !canManageContent)) return
    let active = true

    async function loadCounts() {
      const params = new URLSearchParams()
      if (seenAt.orders) params.set("ordersSeenAt", seenAt.orders)
      if (seenAt.faqs) params.set("faqsSeenAt", seenAt.faqs)

      try {
        const response = await fetch(`/api/admin-unread-counts?${params.toString()}`, { credentials: "same-origin" })
        if (!response.ok) return
        const data = await response.json() as Partial<UnreadCounts>
        if (!active) return
        setUnreadCounts({
          orders: Number.isFinite(data.orders) && Number(data.orders) > 0 ? Number(data.orders) : 0,
          faqs: Number.isFinite(data.faqs) && Number(data.faqs) > 0 ? Number(data.faqs) : 0,
        })
      } catch {
        // Notification counters are supplementary and should never block the admin UI.
      }
    }

    void loadCounts()
    return () => { active = false }
  }, [canManageContent, canReadOrders, preferencesReady, seenAt])

  if (!canReadOrders && !canManageContent) return null

  const formatBadge = (value: number) => value > 99 ? "99+" : String(value)

  return (
    <div className={`admin-workspace-bar${canReadOrders ? "" : " admin-workspace-bar--content"}`}>
      <div className="admin-workspace-bar__identity">
        <span className="admin-workspace-bar__label">Рабочее пространство</span>
        <strong>{canReadOrders ? (workspace === "wholesale" ? "Оптовый кабинет" : workspace === "retail" ? "Розничный кабинет" : "Все контуры") : "Контент"}</strong>
      </div>

      {canReadOrders && <div className="admin-workspace-bar__switch" role="group" aria-label="Контур администрирования">
        {allowed.wholesale && (
          <button type="button" className={workspace === "wholesale" ? "is-active" : ""} onClick={() => selectWorkspace("wholesale")}>
            <BriefcaseBusiness size={15} /> Опт
          </button>
        )}
        {allowed.retail && (
          <button type="button" className={workspace === "retail" ? "is-active" : ""} onClick={() => selectWorkspace("retail")}>
            <ShoppingBag size={15} /> Розница
          </button>
        )}
        {allowed.wholesale && allowed.retail && (
          <button type="button" className={workspace === "all" ? "is-active" : ""} onClick={() => selectWorkspace("all")}>
            <Layers3 size={15} /> Все
          </button>
        )}
      </div>}

      <div className="admin-workspace-bar__links">
        {canReadOrders && <>
          <Link href="/admin/collections/orders" className="admin-workspace-bar__link">
            Заказы {unreadCounts.orders > 0 && <span className="admin-workspace-bar__badge" aria-label={`Новых заказов: ${unreadCounts.orders}`}>{formatBadge(unreadCounts.orders)}</span>}
          </Link>
          <Link href="/admin/collections/clients" className="admin-workspace-bar__link">Клиенты</Link>
        </>}
        {canManageContent && (
          <Link href="/admin/collections/faqs" className="admin-workspace-bar__link">
            FAQ {unreadCounts.faqs > 0 && <span className="admin-workspace-bar__badge" aria-label={`Новых вопросов: ${unreadCounts.faqs}`}>{formatBadge(unreadCounts.faqs)}</span>}
          </Link>
        )}
      </div>
    </div>
  )
}
