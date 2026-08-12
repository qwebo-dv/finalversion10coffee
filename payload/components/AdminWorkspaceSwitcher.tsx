"use client"

import { useAuth } from "@payloadcms/ui"
import { BriefcaseBusiness, Layers3, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import "./AdminWorkspaceSwitcher.scss"

type Workspace = "wholesale" | "retail" | "all"

interface WorkspaceAdmin {
  role?: string | null
  canAccessWholesale?: boolean | null
  canAccessRetail?: boolean | null
}

const COOKIE_NAME = "coffee_admin_workspace"
const FULL_ACCESS_ROLES = new Set(["admin", "manager", "super_admin"])

function getCookie(name: string) {
  const prefix = `${name}=`
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : null
}

export default function AdminWorkspaceSwitcher() {
  const { user } = useAuth()
  const admin = user as WorkspaceAdmin | null
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

  if (!allowed.wholesale && !allowed.retail) return null

  return (
    <div className="admin-workspace-bar">
      <div className="admin-workspace-bar__identity">
        <span className="admin-workspace-bar__label">Рабочее пространство</span>
        <strong>{workspace === "wholesale" ? "Оптовый кабинет" : workspace === "retail" ? "Розничный кабинет" : "Все контуры"}</strong>
      </div>

      <div className="admin-workspace-bar__switch" role="group" aria-label="Контур администрирования">
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
      </div>

      <div className="admin-workspace-bar__links">
        <Link href="/admin/collections/orders">Заказы</Link>
        <Link href="/admin/collections/clients">Клиенты</Link>
      </div>
    </div>
  )
}
