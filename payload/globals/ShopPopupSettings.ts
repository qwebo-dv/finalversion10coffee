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

function validateHexColor(value: unknown): true | string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? true
    : "Укажите цвет в формате #RRGGBB, например #F8F5F1."
}

const colorField = (
  name: string,
  label: string,
  defaultValue: string,
  description?: string,
) => ({
  name,
  type: "text" as const,
  label,
  defaultValue,
  required: true,
  validate: validateHexColor,
  admin: {
    width: "50%",
    description,
    components: {
      Field: "/payload/components/ColorPickerField",
    },
  },
})

const sizeField = (
  name: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
) => ({
  name,
  type: "number" as const,
  label,
  defaultValue,
  min,
  max,
  required: true,
  admin: { width: "50%" },
})

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
      name: "popupPreview",
      type: "ui",
      admin: {
        components: {
          Field: "/payload/components/ShopPopupPreview",
        },
      },
    },
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
            description: "При запуске новой акции увеличьте число на 1 (например, с 1 до 2) — баннер снова увидят все посетители, закрывшие его ранее.",
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
      label: "Изображение упаковки кофе",
      defaultValue: "coffee",
      required: true,
      options: [
        { label: "Стандартная пачка кофе", value: "coffee" },
        { label: "Своя упаковка или товар", value: "image" },
      ],
    },
    {
      name: "visualImage",
      type: "upload",
      relationTo: "media",
      label: "Изображение вместо стандартной пачки",
      admin: {
        condition: (_, siblingData) => siblingData?.visualMode === "image",
        description: "Меняется только пачка кофе. Лучше использовать PNG или WebP с прозрачным фоном, без текста и декоративного фона.",
      },
    },
    {
      name: "visualCaption",
      type: "text",
      label: "Подпись на кофейной иллюстрации",
      defaultValue: "Свежая обжарка · бонусы с каждой покупки",
    },
    {
      type: "collapsible",
      label: "Размеры текста",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            sizeField("titleDesktopFontSize", "Заголовок на компьютере, px", 42, 24, 72),
            sizeField("titleMobileFontSize", "Заголовок на телефоне, px", 30, 20, 52),
          ],
        },
        {
          type: "row",
          fields: [
            sizeField("descriptionDesktopFontSize", "Основной текст на компьютере, px", 15, 10, 28),
            sizeField("descriptionMobileFontSize", "Основной текст на телефоне, px", 14, 10, 24),
          ],
        },
        {
          type: "row",
          fields: [
            sizeField("buttonDesktopFontSize", "Текст кнопки на компьютере, px", 16, 10, 26),
            sizeField("buttonMobileFontSize", "Текст кнопки на телефоне, px", 14, 10, 24),
          ],
        },
        {
          type: "row",
          fields: [
            sizeField("badgeFontSize", "Верхний бейдж, px", 12, 8, 20),
            sizeField("declineFontSize", "Ссылка «Нет, спасибо», px", 12, 9, 20),
          ],
        },
        {
          type: "row",
          fields: [
            sizeField("visualCaptionFontSize", "Подпись справа вверху, px", 10, 8, 18),
            sizeField("promoCodeFontSize", "Промокод на плашке, px", 20, 12, 36),
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Цвета",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            colorField("panelBackgroundColor", "Фон текстовой части", "#F8F5F1"),
            colorField("titleColor", "Основной цвет заголовка", "#1D1D1B"),
          ],
        },
        {
          type: "row",
          fields: [
            colorField("accentColor", "Акцент: 10%, иконки и круглый бейдж", "#E6610D"),
            colorField("descriptionColor", "Основной текст описания", "#655C55"),
          ],
        },
        {
          type: "row",
          fields: [
            colorField("badgeBackgroundColor", "Фон верхнего бейджа", "#FAEAD5"),
            colorField("badgeTextColor", "Текст верхнего бейджа", "#C84E00"),
          ],
        },
        {
          type: "row",
          fields: [
            colorField("buttonBackgroundColor", "Фон основной кнопки", "#5B328A"),
            colorField("buttonTextColor", "Текст основной кнопки", "#FFFFFF"),
          ],
        },
        {
          type: "row",
          fields: [
            colorField("declineTextColor", "Текст ссылки «Нет, спасибо»", "#7D736B"),
            colorField("visualTextColor", "Текст в правой части", "#FFFFFF"),
          ],
        },
        {
          type: "row",
          fields: [
            colorField("visualBackgroundColor", "Основной фон правой части", "#5B328A"),
            colorField("visualGlowColor", "Цвет нижнего свечения справа", "#E6610D"),
          ],
        },
        {
          type: "row",
          fields: [
            colorField("promoPlateBackgroundColor", "Фон плашки промокода", "#1D1D1B"),
            colorField("promoPlateTextColor", "Текст плашки промокода", "#FFFFFF"),
          ],
        },
      ],
    },
  ],
}
