import type { GlobalConfig } from "payload"
import { contentManagerOnly } from "../access/adminRoles"

const DEFAULT_ITEMS = [
  { text: "Промокод 10COFFEE", highlighted: true },
  { text: "Скидка 10% на первый заказ", highlighted: true },
  { text: "Свежая обжарка в Сочи", highlighted: false },
  { text: "Доставка по всей России", highlighted: false },
  { text: "Бонусы за покупки", highlighted: false },
  { text: "Кофе, чай и аксессуары", highlighted: false },
  { text: "Самовывоз в Сочи", highlighted: false },
  { text: "Помол под ваш способ заваривания", highlighted: false },
]

function validateHexColor(value: unknown): true | string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? true
    : "Укажите цвет в формате #RRGGBB, например #CBCAC6."
}

export const ShopTickerSettings: GlobalConfig = {
  slug: "shop-ticker-settings",
  label: "Бегущая строка магазина",
  admin: {
    group: "Настройки",
    description: "Тексты и оформление бегущей строки под главным меню shop.10coffee.ru.",
  },
  access: {
    read: () => true,
    update: contentManagerOnly,
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "enabled",
          type: "checkbox",
          label: "Строка включена",
          defaultValue: true,
          admin: { width: "50%" },
        },
        {
          name: "pauseOnHover",
          type: "checkbox",
          label: "Останавливать при наведении",
          defaultValue: true,
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "items",
      type: "array",
      label: "Тексты",
      labels: { singular: "Сообщение", plural: "Сообщения" },
      minRows: 1,
      maxRows: 30,
      required: true,
      defaultValue: DEFAULT_ITEMS,
      admin: {
        description: "Перетаскивайте сообщения, чтобы менять порядок их показа.",
      },
      fields: [
        {
          name: "text",
          type: "text",
          label: "Текст",
          required: true,
          maxLength: 120,
        },
        {
          name: "highlighted",
          type: "checkbox",
          label: "Использовать цвет выделения",
          defaultValue: false,
        },
      ],
    },
    {
      type: "collapsible",
      label: "Цвета",
      admin: { initCollapsed: false },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "backgroundColor",
              type: "text",
              label: "Фон",
              defaultValue: "#CBCAC6",
              required: true,
              validate: validateHexColor,
              admin: { width: "50%" },
            },
            {
              name: "textColor",
              type: "text",
              label: "Основной текст",
              defaultValue: "#FFFFFF",
              required: true,
              validate: validateHexColor,
              admin: { width: "50%" },
            },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "markerColor",
              type: "text",
              label: "Разделитель",
              defaultValue: "#FFFFFF",
              required: true,
              validate: validateHexColor,
              admin: { width: "50%" },
            },
            {
              name: "highlightColor",
              type: "text",
              label: "Выделенный текст",
              defaultValue: "#FFFFFF",
              required: true,
              validate: validateHexColor,
              admin: { width: "50%" },
            },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Шрифт и движение",
      admin: { initCollapsed: false },
      fields: [
        {
          name: "fontPreset",
          type: "select",
          label: "Шрифт",
          defaultValue: "pixel",
          required: true,
          options: [
            { label: "Press Start 2P — пиксельный", value: "pixel" },
            { label: "Основной шрифт сайта", value: "site" },
            { label: "Моноширинный системный", value: "monospace" },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "desktopFontSize",
              type: "number",
              label: "Размер на компьютере, px",
              defaultValue: 9,
              min: 6,
              max: 24,
              required: true,
              admin: { width: "50%" },
            },
            {
              name: "mobileFontSize",
              type: "number",
              label: "Размер на телефоне, px",
              defaultValue: 8,
              min: 6,
              max: 20,
              required: true,
              admin: { width: "50%" },
            },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "speedSeconds",
              type: "number",
              label: "Время полного цикла, секунд",
              defaultValue: 92,
              min: 10,
              max: 300,
              required: true,
              admin: {
                width: "50%",
                description: "Чем меньше значение, тем быстрее движется строка.",
              },
            },
            {
              name: "marker",
              type: "text",
              label: "Символ-разделитель",
              defaultValue: "✦",
              maxLength: 4,
              required: true,
              admin: { width: "50%" },
            },
          ],
        },
        {
          name: "uppercase",
          type: "checkbox",
          label: "Показывать текст заглавными буквами",
          defaultValue: true,
        },
      ],
    },
  ],
}
