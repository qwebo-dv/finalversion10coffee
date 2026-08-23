import type { GlobalConfig } from "payload"
import { canManageOperations, staffOnly } from "../access/adminRoles"

export const LoyaltySettings: GlobalConfig = {
  slug: "loyalty-settings",
  label: "Программа лояльности",
  admin: { group: "Настройки", description: "Правила начисления и списания баллов для розницы." },
  access: {
    read: staffOnly,
    update: ({ req }) => canManageOperations(req.user),
  },
  fields: [
    { name: "enabled", type: "checkbox", label: "Программа включена", defaultValue: false },
    { name: "expiryDays", type: "number", label: "Срок действия баллов, дней", defaultValue: 60, min: 1 },
    { name: "balanceCap", type: "number", label: "Максимальный баланс", defaultValue: 5000, min: 0 },
    { name: "maxRedemptionPercent", type: "number", label: "Максимум списания от кофе, %", defaultValue: 20, min: 0, max: 100 },
    {
      name: "tiers", type: "array", label: "Ступени начисления", minRows: 1,
      defaultValue: [
        { minSubtotal: 0, percent: 3 }, { minSubtotal: 1000, percent: 5 }, { minSubtotal: 5000, percent: 12 },
      ],
      fields: [
        { name: "minSubtotal", type: "number", required: true, label: "Сумма заказа от, ₽", min: 0 },
        { name: "percent", type: "number", required: true, label: "Кэшбэк, %", min: 0, max: 100 },
      ],
    },
  ],
}
