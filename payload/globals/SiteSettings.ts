import type { GlobalConfig } from "payload"

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Настройки сайта",
  admin: {
    group: "Система",
  },
  fields: [
    {
      name: "loginAnnouncement",
      type: "textarea",
      label: "Объявление в модале входа",
      admin: {
        description: "Текст, который будет показан в модале авторизации на главной странице",
      },
    },
    {
      name: "loginAnnouncementEnabled",
      type: "checkbox",
      label: "Показывать объявление",
      defaultValue: false,
    },
    {
      name: "priceListFile",
      type: "upload",
      relationTo: "media",
      label: "Прайс-лист для скачивания",
      filterOptions: {
        mimeType: { equals: "application/pdf" },
      },
      admin: {
        description: "Выберите загруженный PDF-файл или загрузите новый. Он будет доступен клиентам для скачивания.",
      },
    },
    {
      name: "priceListUrl",
      type: "text",
      label: "Ссылка на прайс-лист (устаревшее поле)",
      admin: {
        hidden: true,
      },
    },
    {
      name: "priceListForm",
      type: "group",
      label: "Форма «Получить прайс-лист»",
      fields: [
        {
          name: "emailFile",
          type: "upload",
          label: "PDF-файл для письма",
          relationTo: "media",
          admin: {
            description: "Прайс-лист, который прикрепляется к письму клиенту. Загружайте сюда актуальный файл.",
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
    update: ({ req }) => !!req.user,
  },
}
