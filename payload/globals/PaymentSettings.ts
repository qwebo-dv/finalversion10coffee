import type { GlobalConfig } from "payload"
import { isSuperAdmin } from "../access/adminRoles"

export const PaymentSettings: GlobalConfig = {
  slug: "payment-settings",
  label: "Онлайн-оплата",
  admin: { group: "Система" },
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      label: "Включить онлайн-оплату YooKassa",
      defaultValue: false,
      admin: { description: "Включайте только после проверки тестового платежа." },
    },
    {
      name: "shopId",
      type: "text",
      label: "shopId",
      admin: { description: "Идентификатор магазина из личного кабинета YooKassa." },
      access: { read: ({ req }) => isSuperAdmin(req.user) },
    },
    {
      name: "secretKey",
      type: "text",
      label: "Секретный ключ",
      admin: { description: "Секретный ключ YooKassa. Не публикуйте его и не передавайте третьим лицам." },
      access: { read: ({ req }) => isSuperAdmin(req.user) },
    },
    {
      name: "returnUrl",
      type: "text",
      label: "URL возврата после оплаты",
      defaultValue: "https://shop.10coffee.ru/order/success",
      admin: { description: "Покупатель попадёт сюда после оплаты; ID заказа добавляется автоматически." },
    },
    {
      name: "webhookUrl",
      type: "text",
      label: "URL уведомлений (webhook)",
      defaultValue: "https://shop.10coffee.ru/api/shop/payments/yookassa/webhook",
      admin: { description: "Укажите этот HTTPS-адрес в YooKassa для событий payment.succeeded и payment.canceled." },
    },
  ],
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
  },
}
