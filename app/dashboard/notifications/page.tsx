"use client"

import { useNotifications } from "@/providers/notification-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCheck, ShoppingBag, Newspaper, Package, BadgePercent } from "lucide-react"
import { formatDateTime } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { NotificationType } from "@/types"

const typeIcons: Record<NotificationType, typeof Bell> = {
  order_update: ShoppingBag,
  news: Newspaper,
  product_restock: Package,
  personal_discount: BadgePercent,
}

const typeLabels: Record<NotificationType, string> = {
  order_update: "Заказ",
  news: "Новости",
  product_restock: "Товар",
  personal_discount: "Скидка",
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Уведомления</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} непрочитанных`
              : "Все уведомления прочитаны"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Прочитать все
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">Нет уведомлений</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Уведомления о заказах и новости появятся здесь
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = typeIcons[notification.type]
            return (
              <div
                key={notification.id}
                className={cn(
                  "flex gap-4 p-4 border rounded-lg transition-colors cursor-pointer",
                  !notification.is_read
                    ? "bg-primary/5 border-primary/20"
                    : "hover:bg-muted/50"
                )}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    !notification.is_read
                      ? "bg-primary/10"
                      : "bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {notification.title}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[notification.type]}
                    </Badge>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {formatDateTime(notification.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
