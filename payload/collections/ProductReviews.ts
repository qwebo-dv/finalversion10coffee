import type { CollectionConfig } from "payload"

export const ProductReviews: CollectionConfig = {
  slug: "product-reviews",
  admin: {
    useAsTitle: "id",
    group: "Каталог",
    description: "Оценки и отзывы на товары",
    defaultColumns: ["product", "authorName", "rating", "comment", "createdAt"],
  },
  labels: {
    singular: "Отзыв",
    plural: "Отзывы",
  },
  access: {
    create: () => true,
    read: () => true,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
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
  ],
  timestamps: true,
}
