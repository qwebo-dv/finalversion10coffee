import type { CollectionConfig } from "payload"
import { productReviewsModerationHandler } from "../endpoints/productReviewsModeration"
import { operationsDeleteAccess, canManageOperations } from "../access/adminRoles"
import { retailOnlyBaseFilter } from "../admin/workspace"

export const ProductReviews: CollectionConfig = {
  slug: "product-reviews",
  admin: {
    useAsTitle: "id",
    group: "Каталог",
    description: "Оценки и отзывы на товары",
    baseFilter: retailOnlyBaseFilter,
    defaultColumns: ["product", "authorName", "rating", "comment", "status", "createdAt"],
    components: {
      beforeList: ["/payload/components/ProductReviewsModeration"],
    },
  },
  labels: {
    singular: "Отзыв",
    plural: "Отзывы",
  },
  access: {
    // Public review creation goes through /api/product-reviews, where the
    // retail session is verified. Payload REST remains closed to anonymous
    // requests so clientId cannot be spoofed.
    create: ({ req }) => canManageOperations(req.user),
    read: ({ req }) => canManageOperations(req.user) || { status: { equals: "approved" } },
    update: ({ req }) => canManageOperations(req.user),
    delete: operationsDeleteAccess,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === "create" && !canManageOperations(req.user) && data) {
          data.status = "pending"
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: "product",
      type: "relationship",
      label: "Товар",
      relationTo: "products",
      required: true,
      admin: {
        description: "Товар, к которому относится оценка или отзыв.",
      },
    },
    {
      name: "authorName",
      type: "text",
      label: "Имя",
    },
    {
      name: "clientId",
      type: "text",
      label: "ID клиента (Supabase)",
      index: true,
      admin: {
        description: "ID пользователя, оставившего отзыв (для личного кабинета).",
      },
    },
    {
      name: "rating",
      type: "number",
      label: "Оценка (звёзд)",
      required: true,
      min: 1,
      max: 5,
      defaultValue: 5,
      admin: {
        description: "1–5 звёзд. Среднее значение всех оценок формирует рейтинг товара.",
      },
    },
    {
      name: "comment",
      type: "textarea",
      label: "Отзыв",
    },
    {
      name: "status",
      type: "select",
      label: "Статус модерации",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "На модерации", value: "pending" },
        { label: "Опубликован", value: "approved" },
        { label: "Отклонён", value: "rejected" },
      ],
      admin: {
        position: "sidebar",
        description: "Отзыв появляется на сайте только после публикации администратором.",
      },
      access: {
        create: ({ req }) => canManageOperations(req.user),
        update: ({ req }) => canManageOperations(req.user),
      },
    },
  ],
  endpoints: [
    {
      path: "/moderation",
      method: "get",
      handler: productReviewsModerationHandler,
    },
    {
      path: "/moderation",
      method: "post",
      handler: productReviewsModerationHandler,
    },
  ],
  timestamps: true,
}
