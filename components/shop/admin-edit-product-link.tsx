"use client"

import Link from "next/link"
import { Pencil } from "lucide-react"
import { usePayloadAdminEdit } from "@/providers/payload-admin-edit-provider"

export function AdminEditProductLink({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const { canEditProducts } = usePayloadAdminEdit()
  if (!canEditProducts) return null

  return (
    <Link
      href={`/admin/collections/products/${encodeURIComponent(productId)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Редактировать товар в Payload"
      title="Редактировать товар в Payload"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1b] font-bold text-white shadow-lg ring-2 ring-white/80 transition hover:bg-[#5b328a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b328a] ${compact ? "h-9 w-9" : "h-11 px-4 text-sm"}`}
    >
      <Pencil className="h-4 w-4" />
      {!compact && <span>Редактировать</span>}
    </Link>
  )
}
