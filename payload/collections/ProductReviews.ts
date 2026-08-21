import type { CollectionConfig } from "payload"
import { productReviewsModerationHandler } from "../endpoints/productReviewsModeration"
import { operationsDeleteAccess, canManageContent } from "../access/adminRoles"
import { retailOnlyBaseFilter } from "../admin/workspace"

export const ProductReviews: CollectionConfig = {
  slug: "product-reviews",
  admin: {
    useAsTitle: "id",
    group: "Каталог",
    description: "Оценки и отзывы на товары",
    baseFilter: retailOnlyBaseFilter,
    defaultColumns: ["product", "authorClient", "authorName", "rating", "comment", "status", "createdAt"],
    components: {
      beforeList: ["/payload/components/ProductReviewsModeration"],
    },
  },
  labels: {
    singular: "Отзыв",
    plural: "Отзывы",
  },
  access: {
    // Public review creation goes through /api/shop/product-reviews, where the
    // retail session is verified. Payload REST remains closed to anonymous
    // requests so clientId cannot be spoofed.
    create: ({ req }) => canManageContent(req.user),
    read: ({ req }) => canManageContent(req.user) || { status: { equals: "approved" } },
    update: ({ req }) => canManageContent(req.user),
    delete: operationsDeleteAccess,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req, originalDoc }) => {
        if (operation === "create" && !canManageContent(req.user) && data) {
          data.status = "pending"
        }
        if (data && canManageContent(req.user)) {
          const authorClient = data.authorClient ?? originalDoc?.authorClient
          const authorName = String(data.authorName ?? originalDoc?.authorName ?? "").trim()
          if (authorClient && authorName) {
            throw new Error("Укажите либо клиента, либо другое имя автора — не оба поля одновременно.")
          }
          if (!authorClient && !authorName) {
            throw new Error("Выберите клиента или укажите другое имя автора.")
          }
          if (typeof data.authorName === "string") data.authorName = data.authorName.trim()
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
      type: "row",
      fields: [
        {
          name: "authorClient",
          type: "relationship",
          label: "Клиент",
          relationTo: "clients",
          admin: {
            width: "50%",
            description: "Выберите клиента либо оставьте поле пустым и укажите другое имя.",
          },
        },
        {
          name: "authorName",
          type: "text",
          label: "Другое имя",
          admin: {
            width: "50%",
            placeholder: "Например, Анна",
            description: "Произвольное имя автора. Не заполняйте, если выбран клиент.",
          },
        },
      ],
    },
    {
      name: "clientId",
      type: "text",
      label: "ID клиента (Supabase)",
      index: true,
      admin: {
        description: "ID пользователя, оставившего отзыв (для личного кабинета).",
        readOnly: true,
        position: "sidebar",
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
        create: ({ req }) => canManageContent(req.user),
        update: ({ req }) => canManageContent(req.user),
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
