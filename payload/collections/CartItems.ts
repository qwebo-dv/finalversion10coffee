import type { CollectionConfig } from "payload"
import { adminOnly } from "../access/adminOnly"

export const CartItems: CollectionConfig = {
  slug: "cart-items",
  admin: {
    group: "Клиенты",
    description: "Корзины клиентов",
    defaultColumns: ["clientId", "product", "variantId", "quantity"],
  },
  labels: {
    singular: "Элемент корзины",
    plural: "Корзина",
  },
  fields: [
    {
      name: "clientId",
      type: "text",
      label: "ID клиента (Supabase)",
      required: true,
      index: true,
    },
    {
      name: "product",
      type: "relationship",
      label: "Товар",
      relationTo: "products",
      required: true,
    },
    {
      name: "variantId",
      type: "text",
      label: "ID варианта (из массива variants продукта)",
      required: true,
    },
    {
      name: "quantity",
      type: "number",
      label: "Количество",
      required: true,
      min: 1,
      defaultValue: 1,
    },
    {
      name: "grindOption",
      type: "text",
      label: "Помол",
    },
  ],
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
}
