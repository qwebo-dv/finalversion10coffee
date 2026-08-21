"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BadgePercent, Bell, CheckCheck, ChevronRight, Heart, LogOut, Newspaper, Package, Settings, ShoppingBag } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { useNotifications } from "@/providers/notification-provider"
import type { Notification, NotificationType } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  order_update: ShoppingBag,
  news: Newspaper,
  product_restock: Package,
  personal_discount: BadgePercent,
}

function formatNotificationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
}

function NotificationItem({ item, onOpen }: { item: Notification; onOpen: (item: Notification) => void }) {
  const Icon = TYPE_ICON[item.type] || Bell
  return (
    <button type="button" data-notification-id={item.id} onClick={() => onOpen(item)} className={`flex w-full gap-3 px-4 py-3 text-left ${item.is_read ? "" : "bg-[#f8f1fc]"} hover:bg-[#f8f5f1]`}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#faead5] text-[#e6610d]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="flex items-start gap-2"><p className="flex-1 text-xs font-black text-[#1d1d1b]">{item.title}</p>{!item.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e6610d]" />}</div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#766d66]">{item.message}</p>
        <time className="mt-1.5 block text-[10px] text-[#a39890]">{formatNotificationDate(item.created_at)}</time>
      </div>
    </button>
  )
}

function NotificationsFeed({ notifications, loading, markAsRead, onOpen }: { notifications: Notification[]; loading: boolean; markAsRead: (id: string) => Promise<void>; onOpen: (item: Notification) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(new Set<string>())

  useEffect(() => {
    const root = scrollRef.current
    if (!root || loading) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.notificationId
        if (entry.isIntersecting && entry.intersectionRatio >= 0.75 && id && !viewedRef.current.has(id)) {
          viewedRef.current.add(id)
          const notification = notifications.find((item) => item.id === id)
          if (notification && !notification.is_read) void markAsRead(id)
        }
      }
    }, { root, threshold: [0.75] })
    root.querySelectorAll<HTMLElement>("[data-notification-id]").forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [loading, markAsRead, notifications])

  return (
    <div ref={scrollRef} className="max-h-[360px] overflow-y-auto">
      {loading ? <p className="px-4 py-12 text-center text-xs text-[#8d827a]">Загружаем уведомления…</p>
        : notifications.length ? notifications.map((item) => <NotificationItem key={item.id} item={item} onOpen={onOpen} />)
          : <div className="px-4 py-14 text-center"><Bell className="mx-auto h-8 w-8 text-[#e0d8d1]" /><p className="mt-3 text-xs font-bold text-[#766d66]">Пока уведомлений нет</p><p className="mt-1 text-[11px] leading-4 text-[#a39890]">Здесь будут новости, статусы заказов и персональные предложения.</p></div>}
    </div>
  )
}

export function NotificationMenu({ avatarUrl, displayName, initial }: { avatarUrl: string | null; displayName: string; initial: string }) {
  const router = useRouter()
  const { signOut } = useAuth()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => document.removeEventListener("mousedown", closeOnOutsideClick)
  }, [])

  function openNotification(notification: Notification) {
    if (!notification.is_read) void markAsRead(notification.id)
    setSelectedNotification(notification)
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      setOpen(false)
      router.replace("/shop")
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-white transition hover:bg-white/10"
        aria-label={unreadCount ? `Профиль и уведомления: ${unreadCount} непрочитанных` : "Профиль и уведомления"}
        aria-expanded={open}
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-visible rounded-full bg-[#e6610d] text-[10px] font-black text-white">
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}</span>
          {unreadCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e6610d] px-1 text-[9px] font-black text-white ring-2 ring-[#1d1d1b]">{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </span>
        <span className="max-w-[130px] truncate text-xs font-bold">{displayName}</span>
      </button>

      {open && (
        <section className="absolute right-0 top-[calc(100%+10px)] z-[60] grid w-[620px] grid-cols-[1.12fr_.88fr] overflow-hidden rounded-2xl border border-black/[0.08] bg-white text-[#1d1d1b] shadow-[0_24px_70px_rgba(45,27,17,0.22)]" aria-label="Профиль и уведомления">
          <div className="min-h-[330px] border-r border-black/[0.06]">
            <header className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <div><h2 className="text-sm font-black">Уведомления</h2><p className="mt-0.5 text-[11px] text-[#8d827a]">{unreadCount ? `${unreadCount} непрочитанных` : "Все прочитано"}</p></div>
              {unreadCount > 0 && <button type="button" onClick={() => void markAllAsRead()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#f4edfa] px-2.5 py-1.5 text-[11px] font-bold text-[#5b328a] transition hover:bg-[#eadcf6]"><CheckCheck className="h-3.5 w-3.5" />Прочитать все</button>}
            </header>
            <NotificationsFeed notifications={notifications} loading={loading} markAsRead={markAsRead} onOpen={openNotification} />
          </div>
          <div className="flex flex-col p-4">
            <Link href="/main" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[#f8f5f1]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e6610d] text-sm font-black text-white">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{displayName}</span><span className="mt-0.5 block text-[11px] text-[#8d827a]">Личный кабинет</span></span><ChevronRight className="h-4 w-4 text-[#b4aaa2]" />
            </Link>
            <nav className="mt-4 space-y-1 border-t border-black/[0.06] pt-3">
              <Link href="/main/orders" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#554b43] transition hover:bg-[#f8f5f1] hover:text-[#5b328a]"><ShoppingBag className="h-4 w-4 text-[#8d827a]" />Мои заказы</Link>
              <Link href="/main/favorites" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#554b43] transition hover:bg-[#f8f5f1] hover:text-[#5b328a]"><Heart className="h-4 w-4 text-[#8d827a]" />Избранное</Link>
              <Link href="/main/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#554b43] transition hover:bg-[#f8f5f1] hover:text-[#5b328a]"><Settings className="h-4 w-4 text-[#8d827a]" />Настройки профиля</Link>
            </nav>
            <button type="button" onClick={() => void handleSignOut()} disabled={signingOut} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[#d54a00] transition hover:bg-[#fff1e9] disabled:cursor-wait disabled:opacity-60">
              <LogOut className="h-4 w-4" />{signingOut ? "Выходим…" : "Выйти"}
            </button>
          </div>
        </section>
      )}
      <Dialog open={Boolean(selectedNotification)} onOpenChange={(nextOpen) => { if (!nextOpen) setSelectedNotification(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{selectedNotification?.title}</DialogTitle></DialogHeader>
          {selectedNotification && <div className="space-y-3 text-sm leading-6 text-[#554b43]"><p className="whitespace-pre-wrap">{selectedNotification.message}</p><time className="block text-xs text-[#8d827a]">{formatNotificationDate(selectedNotification.created_at)}</time></div>}
        </DialogContent>
      </Dialog>
    </div>
  )
}
