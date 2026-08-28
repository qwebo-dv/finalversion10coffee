import type { GlobalConfig } from "payload"
import { contentManagerOnly } from "../access/adminRoles"

const defaultDescription = {
  root: {
    type: "root",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    children: [
      {
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        direction: "ltr",
        textFormat: 0,
        textStyle: "",
        children: [
          {
            type: "text",
            version: 1,
            text: "Зарегистрируйтесь в личном кабинете 10coffee, используйте промокод 10COFFEE, копите бонусы с покупок и оплачивайте ими новые заказы.",
            format: 0,
            style: "",
            mode: "normal",
            detail: 0,
          },
        ],
      },
    ],
  },
}

export const ShopPopupSettings: GlobalConfig = {
  slug: "shop-popup-settings",
  label: "Промо-баннер магазина",
  admin: {
    group: "Настройки",
    description: "Первый экран для новых посетителей shop.10coffee.ru. Измените версию кампании, чтобы повторно показать обновлённый баннер.",
  },
  access: {
    read: () => true,
    update: contentManagerOnly,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "enabled", type: "checkbox", label: "Баннер включён", defaultValue: false, admin: { width: "50%" } },
        {
          name: "campaignVersion",
          type: "number",
          label: "Версия кампании",
          defaultValue: 1,
          min: 1,
          required: true,
          admin: {
            width: "50%",
            description: "Увеличьте число, если баннер должны снова увидеть посетители, закрывшие предыдущую версию.",
          },
        },
      ],
    },
    {
      name: "badgeText",
      type: "text",
      label: "Надпись над заголовком",
      defaultValue: "Предложение для нового покупателя",
      required: true,
    },
    {
      name: "title",
      type: "text",
      label: "Заголовок",
      defaultValue: "Дарим 10% на первый заказ и бонусы за каждый следующий",
      required: true,
      admin: { description: "Фрагмент «10% на первый заказ» автоматически выделяется фирменным оранжевым цветом." },
    },
    {
      name: "description",
      type: "richText",
      label: "Текст баннера",
      required: true,
      defaultValue: defaultDescription,
    },
    {
      type: "row",
      fields: [
        { name: "promoCode", type: "text", label: "Промокод", defaultValue: "10COFFEE", required: true, admin: { width: "50%" } },
        { name: "ctaLabel", type: "text", label: "Текст основной кнопки", defaultValue: "Получить скидку 10% и зарегистрироваться", required: true, admin: { width: "50%" } },
      ],
    },
    {
      name: "declineLabel",
      type: "text",
      label: "Текст ссылки отказа",
      defaultValue: "Нет, спасибо, я предпочитаю платить полную цену",
      required: true,
    },
    {
      name: "visualMode",
      type: "select",
      label: "Правая часть",
      defaultValue: "coffee",
      required: true,
      options: [
        { label: "Фирменная кофейная иллюстрация", value: "coffee" },
        { label: "Собственное изображение", value: "image" },
      ],
    },
    {
      name: "visualImage",
      type: "upload",
      relationTo: "media",
      label: "Изображение для правой части",
      admin: {
        condition: (_, siblingData) => siblingData?.visualMode === "image",
        description: "Рекомендуемое соотношение 4:5, размер не менее 900 × 1125 px. Текст и кнопки остаются отдельно и не обрезаются.",
      },
    },
    {
      name: "visualCaption",
      type: "text",
      label: "Подпись на кофейной иллюстрации",
      defaultValue: "Свежая обжарка · бонусы с каждой покупки",
      admin: { condition: (_, siblingData) => siblingData?.visualMode !== "image" },
    },
  ],
}
