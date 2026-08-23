import type { CollectionConfig } from "payload"
import { staffOnly } from "../access/adminRoles"

/**
 * Append-only accounting journal for retail bonus points. A balance is always
 * calculated from journal entries; it is never stored as a mutable client field.
 */
export const LoyaltyOperations: CollectionConfig = {
  slug: "loyalty-operations",
  admin: {
    useAsTitle: "idempotencyKey",
    group: "Клиенты",
    description: "Неизменяемый журнал операций программы лояльности",
    defaultColumns: ["createdAt", "client", "order", "type", "amount", "status", "expiresAt"],
  },
  labels: { singular: "Операция лояльности", plural: "Операции лояльности" },
  access: {
    read: staffOnly,
    // The journal is changed only by trusted server workflows using
    // overrideAccess. Manual mutations would break the calculated balance.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "client", type: "relationship", relationTo: "clients", required: true, index: true, label: "Клиент" },
    { name: "order", type: "relationship", relationTo: "orders", index: true, label: "Заказ" },
    {
      name: "type", type: "select", required: true, label: "Тип", options: [
        { label: "Начисление", value: "accrual" }, { label: "Резерв", value: "reservation" },
        { label: "Списание", value: "redemption" }, { label: "Снятие резерва", value: "release" },
        { label: "Возврат", value: "refund" }, { label: "Аннулирование", value: "reversal" },
        { label: "Сгорание", value: "expiry" },
      ],
    },
    { name: "amount", type: "number", required: true, label: "Баллы", admin: { description: "Знаковое значение: начисление +, списание −." } },
    {
      name: "status", type: "select", required: true, defaultValue: "active", label: "Статус", options: [
        { label: "Ожидает", value: "pending" }, { label: "Активна", value: "active" },
        { label: "Освобождена", value: "released" }, { label: "Аннулирована", value: "reversed" }, { label: "Сгорела", value: "expired" },
      ],
    },
    { name: "idempotencyKey", type: "text", required: true, unique: true, label: "Ключ идемпотентности", admin: { readOnly: true } },
    { name: "expiresAt", type: "date", label: "Действует до", index: true },
    { name: "note", type: "textarea", label: "Комментарий", admin: { readOnly: true } },
  ],
}
