import type { GlobalConfig } from "payload"
import { contentManagerOnly } from "../access/adminRoles"

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Настройки сайта",
  admin: {
    group: "Система",
  },
  fields: [
    {
      name: "priceListForm",
      type: "group",
      label: "Форма «Получить прайс-лист»",
      fields: [
        {
          name: "emailFile",
          type: "upload",
          label: "Прайс-лист (PDF)",
          relationTo: "media",
          admin: {
            description: "Единый файл для скачивания на сайте и вложения в письма. Его публичная ссылка создаётся автоматически.",
          },
        },
        {
          name: "senderName",
          type: "text",
          label: "Имя отправителя",
          admin: { placeholder: "Иван Иванов" },
        },
        {
          name: "senderPosition",
          type: "text",
          label: "Должность",
          admin: { placeholder: "Руководитель отдела продаж" },
        },
        {
          name: "senderPhone",
          type: "text",
          label: "Телефон",
          admin: { placeholder: "+7 (999) 123-45-67" },
        },
        {
          name: "senderTelegram",
          type: "text",
          label: "Telegram / WhatsApp",
          admin: { placeholder: "@Ten120886" },
        },
      ],
    },
    {
      name: "vatPercent",
      type: "number",
      label: "Ставка НДС (%)",
      defaultValue: 22,
      min: 0,
      max: 100,
      admin: {
        description: "Глобальная ставка НДС, применяется ко всем новым заказам и счетам. 0 = без НДС.",
      },
    },
  ],
  access: {
    read: () => true,
    update: contentManagerOnly,
  },
}
