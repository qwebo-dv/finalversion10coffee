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
      label: "Прайс-лист (PDF)",
      relationTo: "media",
      admin: {
        description: "Файл прайс-листа для кнопки «Прайс-лист» в личном кабинете. Загрузите актуальный PDF — ссылка на скачивание сформируется автоматически.",
      },
    },
    {
      // Заменено на priceListFile (загрузчик файла) выше — оставлено скрытым
      // только для обратной совместимости со старыми значениями (пока
      // priceListFile не выбран, код использует эту ссылку как запасной
      // вариант). Новые значения сюда вводить не нужно.
      name: "priceListUrl",
      type: "text",
      label: "Ссылка на прайс-лист (устарело)",
      admin: {
        hidden: true,
        description: "Устаревшее поле, используется как запасной вариант. Загрузите файл в поле «Прайс-лист (PDF)» выше.",
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
