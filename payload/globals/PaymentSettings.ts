import type { GlobalConfig } from "payload"

export const PaymentSettings: GlobalConfig = {
  slug: "payment-settings",
  label: "Онлайн-оплата",
  admin: { group: "Система" },
  fields: [
    {
      name: "enabled",
      type: "checkbox",
      label: "Включить онлайн-оплату Сбер",
      defaultValue: false,
      admin: { description: "Включайте только после проверки тестового платежа." },
    },
    {
      name: "environment",
      type: "select",
      label: "Контур Сбера",
      defaultValue: "production",
      options: [
        { label: "Боевой", value: "production" },
        { label: "Тестовый", value: "test" },
      ],
    },
    {
      name: "apiUrl",
      type: "text",
      label: "URL API платёжного шлюза",
      defaultValue: "https://ecommerce.sberbank.ru/ecomm/gw/partner/api/v1",
      admin: { description: "Боевой адрес по умолчанию. Для тестового контура укажите адрес из письма Сбера." },
    },
    {
      name: "username",
      type: "text",
      label: "Логин API (userName)",
      admin: { description: "Логин мерчанта, который предоставит Сбер." },
      access: { read: ({ req }) => Boolean(req.user) },
    },
    {
      name: "password",
      type: "text",
      label: "Пароль API",
      admin: { description: "Пароль платёжного шлюза от Сбера. Не передавайте его третьим лицам." },
      access: { read: ({ req }) => Boolean(req.user) },
    },
    {
      name: "returnUrl",
      type: "text",
      label: "URL успешного возврата",
      defaultValue: "https://shop.10coffee.ru/order/success",
      admin: { description: "Покупатель попадёт сюда после успешной оплаты." },
    },
    {
      name: "failUrl",
      type: "text",
      label: "URL возврата при отмене / ошибке",
      defaultValue: "https://shop.10coffee.ru/order/failed",
    },
    {
      name: "callbackUrl",
      type: "text",
      label: "URL уведомлений (callback)",
      defaultValue: "https://shop.10coffee.ru/api/shop/payments/sber/callback",
      admin: { description: "Этот адрес передаётся в Сбер для автоматического обновления статуса платежа. Он должен быть публично доступен по HTTPS." },
    },
  ],
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
}
