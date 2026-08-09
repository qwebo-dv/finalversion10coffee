"use client"

import { useState } from "react"
import { useAuth } from "@/providers/auth-provider"
import { signOut } from "@/lib/actions/auth"
import { Bell, LogOut, ChevronDown, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface TopBarProps {
  notificationCount?: number
}

export function TopBar({ notificationCount = 0 }: TopBarProps) {
  const { user } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"

  async function handleSignOut() {
    setSigningOut(true)
    await signOut("business")
  }

  return (
    <header className="flex h-12 items-center justify-end gap-3 sm:gap-5 border-b border-gray-200 bg-white px-3 sm:px-6 text-sm">
      <Link
        href="https://10coffee.ru"
        target="_blank"
        className="hidden sm:flex items-center gap-1 text-gray-500 hover:text-black transition-colors text-xs font-medium"
      >
        НА ОПТОВЫЙ САЙТ
        <ExternalLink className="h-3 w-3" />
      </Link>

      <Link
        href="/dashboard/notifications"
        className="flex items-center gap-1.5 text-gray-500 hover:text-black transition-colors text-xs font-medium"
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">УВЕДОМЛЕНИЯ</span>
        {notificationCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-black text-white text-[9px] font-bold px-1">
            {notificationCount}
          </span>
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-gray-700 hover:text-black transition-colors text-xs font-medium outline-none">
          {displayName.toUpperCase()}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs text-gray-500">
            {user?.email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" className="text-xs cursor-pointer">
              Настройки
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs text-red-600 focus:text-red-600 cursor-pointer"
          >
            <LogOut className="mr-2 h-3 w-3" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
