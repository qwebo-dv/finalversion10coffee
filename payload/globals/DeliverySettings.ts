import type { Field, GlobalConfig } from "payload"
import { staffOnly } from "../access/adminRoles"

function packageFields(params: {
  name: "packageS" | "packageM" | "packageL"
  label: string
  lengthCm: number
  widthCm: number
  heightCm: number
  maxWeightGrams: number
  costRubles: number
}): Field {
  return {
    name: params.name,
    type: "group",
    label: params.label,
    admin: {
      description: `${params.lengthCm} × ${params.widthCm} × ${params.heightCm} см · до ${params.maxWeightGrams / 1000} кг`,
    },
    fields: [
      {
        type: "row",
        fields: [
          { name: "lengthCm", type: "number", label: "Длина, см", required: true, min: 1, defaultValue: params.lengthCm, admin: { width: "20%" } },
          { name: "widthCm", type: "number", label: "Ширина, см", required: true, min: 1, defaultValue: params.widthCm, admin: { width: "20%" } },
          { name: "heightCm", type: "number", label: "Высота, см", required: true, min: 1, defaultValue: params.heightCm, admin: { width: "20%" } },
          { name: "maxWeightGrams", type: "number", label: "Максимальный вес, г", required: true, min: 1, defaultValue: params.maxWeightGrams, admin: { width: "20%" } },
          { name: "costRubles", type: "number", label: "Стоимость упаковки, ₽", required: true, min: 0, defaultValue: params.costRubles, admin: { width: "20%" } },
        ],
      },
    ],
  }
}

export const DeliverySettings: GlobalConfig = {
  slug: "delivery-settings",
  label: "Настройки доставки",
  admin: {
    group: "Система",
    description: "Размеры и стоимость транспортной упаковки. Стоимость автоматически включается в тариф СДЭК.",
  },
  access: {
    read: staffOnly,
    update: staffOnly,
  },
  fields: [
    {
      name: "cdekPackagingEnabled",
      type: "checkbox",
      label: "Добавлять стоимость упаковки к тарифу СДЭК",
      defaultValue: true,
    },
    packageFields({ name: "packageS", label: "Упаковка S", lengthCm: 25, widthCm: 10, heightCm: 15, maxWeightGrams: 2000, costRubles: 100 }),
    packageFields({ name: "packageM", label: "Упаковка M", lengthCm: 35, widthCm: 15, heightCm: 25, maxWeightGrams: 5000, costRubles: 200 }),
    packageFields({ name: "packageL", label: "Упаковка L", lengthCm: 45, widthCm: 30, heightCm: 20, maxWeightGrams: 12000, costRubles: 400 }),
    {
      name: "fallbackPackageSize",
      type: "select",
      label: "Упаковка для товара без заполненных габаритов",
      defaultValue: "S",
      required: true,
      options: [
        { label: "S", value: "S" },
        { label: "M", value: "M" },
        { label: "L", value: "L" },
      ],
      admin: {
        description: "Если у варианта товара не заполнены все три габарита, одна единица товара занимает выбранную упаковку целиком.",
      },
    },
  ],
}
