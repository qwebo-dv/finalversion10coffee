import type { CollectionConfig } from "payload"
import { canManageOperations, canReadOperations, operationsDeleteAccess } from "../access/adminRoles"
import { wholesaleOnlyBaseFilter } from "../admin/workspace"

export const PriceListRequests: CollectionConfig = {
  slug: "price-list-requests",
  admin: {
    useAsTitle: "name",
    group: "Маркетинг",
    description: "Заявки на прайс-лист с лендинга",
    baseFilter: wholesaleOnlyBaseFilter,
    defaultColumns: ["name", "email", "phone", "company", "createdAt"],
  },
  labels: {
    singular: "Заявка на прайс-лист",
    plural: "Получатели прайс-листа",
  },
  access: {
    create: () => true,
    read: ({ req }) => canReadOperations(req.user),
    update: ({ req }) => canManageOperations(req.user),
    delete: operationsDeleteAccess,
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Имя",
      required: true,
    },
    {
      name: "email",
      type: "email",
      label: "Email",
      required: true,
    },
    {
      name: "phone",
      type: "text",
      label: "Телефон",
      required: true,
    },
    {
      name: "company",
      type: "text",
      label: "Компания",
    },
    {
      name: "emailSent",
      type: "checkbox",
      label: "Письмо отправлено",
      defaultValue: false,
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}
