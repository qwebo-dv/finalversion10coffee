import type { CollectionConfig } from "payload"
import { canReadOperations, operationsDeleteAccess } from "../access/adminRoles"
import { retailOnlyBaseFilter } from "../admin/workspace"

export const CartItems: CollectionConfig = {
  slug: "cart-items",
  admin: {
    group: "Клиенты",
    description: "Корзины клиентов",
    baseFilter: retailOnlyBaseFilter,
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
    read: ({ req }) => canReadOperations(req.user),
    create: () => false,
    update: () => false,
    delete: operationsDeleteAccess,
  },
}
