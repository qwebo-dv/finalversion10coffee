import type { CollectionConfig, Where } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"
import { PRODUCT_DETAILS_SCHEMA_OPTIONS } from "@/lib/product-types"

export const ProductTypes: CollectionConfig = {
  slug: "product-types",
  admin: {
    useAsTitle: "name",
    group: "Каталог",
    description: "Управляемые типы товаров для вкладок каталога",
    defaultColumns: ["name", "slug", "detailsSchema", "sortOrder", "isVisible"],
  },
  labels: {
    singular: "Тип товара",
    plural: "Типы товаров",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Название",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      label: "Slug",
      required: true,
      unique: true,
      admin: {
        description: "Латиница без пробелов, например coffee, tea, syrups",
      },
    },
    {
      name: "moyskladId",
      type: "text",
      label: "ID группы/типа в МойСклад",
      admin: {
        position: "sidebar",
        description: "Опциональная связь с группой товаров в МойСклад.",
      },
    },
    {
      name: "icon",
      type: "upload",
      label: "SVG-иконка",
      relationTo: "media",
      admin: {
        description: "На фронте иконка выводится размером 14x14 px",
      },
    },
    {
      name: "detailsSchema",
      type: "select",
      label: "Схема характеристик товара",
      required: true,
      defaultValue: "generic",
      options: [...PRODUCT_DETAILS_SCHEMA_OPTIONS],
      admin: {
        description: "Определяет, какие блоки характеристик будут доступны у товаров этого типа.",
      },
    },
    {
      name: "sortOrder",
      type: "number",
      label: "Порядок сортировки",
      defaultValue: 0,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "isVisible",
      type: "checkbox",
      label: "Показывать на фронте",
      defaultValue: true,
      admin: {
        position: "sidebar",
      },
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        const usageWhere: Where = { productTypeRef: { equals: id } }

        const [products, categories] = await Promise.all([
          req.payload.find({
            collection: "products",
            where: usageWhere,
            limit: 1,
            depth: 0,
          }),
          req.payload.find({
            collection: "categories",
            where: usageWhere,
            limit: 1,
            depth: 0,
          }),
        ])

        if (products.totalDocs > 0 || categories.totalDocs > 0) {
          throw new Error("Нельзя удалить тип товара, пока к нему привязаны товары или категории.")
        }
      },
    ],
  },
  access: {
    read: () => true,
    create: contentManagerOnly,
    update: contentManagerOnly,
    delete: superAdminOnly,
  },
}
