import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"

export const CoffeeBrewingGuides: CollectionConfig = {
  slug: "coffee-brewing-guides",
  admin: {
    useAsTitle: "title",
    group: "Контент",
    description: "Общие способы приготовления, которые показываются у всех сортов кофе.",
    defaultColumns: ["title", "article", "sortOrder", "isVisible", "updatedAt"],
  },
  labels: {
    singular: "Способ приготовления кофе",
    plural: "Способы приготовления кофе",
  },
  access: {
    read: ({ req }) => contentManagerOnly({ req }) || { isVisible: { equals: true } },
    create: contentManagerOnly,
    update: contentManagerOnly,
    delete: superAdminOnly,
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "Название плитки",
      required: true,
      admin: {
        description: "Например: Эспрессо, Турка или Френч-пресс.",
      },
    },
    {
      name: "article",
      type: "relationship",
      label: "Опубликованная статья",
      relationTo: "blog_posts",
      required: true,
      filterOptions: {
        isPublished: { equals: true },
      },
      admin: {
        description: "Текст этой статьи открывается в окне на карточке каждого кофе.",
      },
    },
    {
      name: "sortOrder",
      type: "number",
      label: "Порядок",
      required: true,
      defaultValue: 0,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "isVisible",
      type: "checkbox",
      label: "Показывать на сайте",
      defaultValue: true,
      admin: {
        position: "sidebar",
      },
    },
  ],
  timestamps: true,
}
