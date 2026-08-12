import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"

export const MapLocations: CollectionConfig = {
  slug: "map-locations",
  admin: {
    useAsTitle: "name",
    group: "Контент",
    description: "Точки на карте — кофейни где можно попробовать наш кофе",
    defaultColumns: ["name", "city", "address", "workingHours", "isActive"],
  },
  labels: {
    singular: "Точка на карте",
    plural: "Точки на карте",
  },
  fields: [
    {
      name: "city",
      type: "text",
      label: "Город",
      required: true,
      defaultValue: "Сочи",
      admin: {
        description: "Город для фильтрации на карте",
      },
    },
    {
      name: "name",
      type: "text",
      label: "Название",
      required: true,
    },
    {
      name: "image",
      type: "upload",
      label: "Фото",
      relationTo: "media",
      admin: {
        description: "Фото кофейни / точки продаж",
      },
    },
    {
      name: "address",
      type: "text",
      label: "Адрес",
      required: true,
    },
    {
      name: "phone",
      type: "text",
      label: "Телефон",
      admin: {
        description: "Например: +7 (910) 145-72-78",
      },
    },
    {
      name: "workingHours",
      type: "text",
      label: "Часы работы",
      admin: {
        description: "Например: Открыто до 22:00 или Пн-Пт 8:00-21:00",
      },
    },
    {
      name: "tags",
      type: "select",
      label: "Теги",
      hasMany: true,
      options: [
        { label: "Продают в пачках", value: "sells_bags" },
        { label: "Есть фильтр-кофе", value: "filter_coffee" },
        { label: "Есть декаф", value: "decaf" },
        { label: "Есть еда", value: "has_food" },
        { label: "Дог френдли", value: "dog_friendly" },
        { label: "Есть Wi-Fi", value: "wifi" },
        { label: "Есть альт. молоко", value: "alt_milk" },
        { label: "Есть десерты", value: "desserts" },
      ],
      admin: {
        description: "Выберите подходящие теги",
      },
    },
    {
      name: "yandexMapsUrl",
      type: "text",
      label: "Ссылка на Яндекс.Карты",
      required: true,
      admin: {
        description:
          "Скопируйте ссылку из Яндекс.Карт, например: https://yandex.com/maps/-/CPulnF33",
      },
    },
    {
      name: "coordinates",
      type: "text",
      label: "Координаты",
      admin: {
        description: "Вставьте из Яндекс.Карт: 43.582661, 39.718557 — автоматически разобьётся на широту и долготу",
      },
    },
    {
      name: "latitude",
      type: "number",
      label: "Широта",
      required: true,
      admin: {
        step: 0.000001,
        description: "Для пина на карте. Например: 43.585472",
      },
    },
    {
      name: "longitude",
      type: "number",
      label: "Долгота",
      required: true,
      admin: {
        step: 0.000001,
        description: "Для пина на карте. Например: 39.723098",
      },
    },
    {
      name: "isActive",
      type: "checkbox",
      label: "Активна",
      defaultValue: true,
      admin: {
        position: "sidebar",
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.coordinates && typeof data.coordinates === "string") {
          const parts = data.coordinates.split(",").map((s: string) => parseFloat(s.trim()))
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            data.latitude = parts[0]
            data.longitude = parts[1]
          }
          delete data.coordinates
        }
        return data
      },
    ],
  },
  access: {
    read: () => true,
    create: contentManagerOnly,
    update: contentManagerOnly,
    delete: superAdminOnly,
  },
}
