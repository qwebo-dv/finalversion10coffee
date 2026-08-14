import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"
import { getRelationshipId } from "@/lib/product-types"
import { validateCategoryProductType } from "../hooks/validateCategoryProductType"
import { ensureSlug } from "../hooks/ensureSlug"

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "name",
    group: "Каталог",
    description: "Категории товаров",
    defaultColumns: ["name", "productTypeRef", "parent", "sortOrder", "isVisible"],
  },
  labels: {
    singular: "Категория",
    plural: "Категории",
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
      label: "Slug (URL)",
      required: true,
      unique: true,
      admin: {
        description: "URL-имя категории (латиница, дефисы)",
        components: {
          Field: "/payload/components/SlugField",
        },
      },
    },
    {
      name: "moyskladId",
      type: "text",
      label: "ID группы товаров в МойСклад",
      admin: {
        position: "sidebar",
        description: "Используется для сопоставления категории сайта с productfolder в МойСклад.",
      },
    },
    {
      name: "productTypeRef",
      type: "relationship",
      label: "Тип товара",
      relationTo: "product-types",
      required: true,
      admin: {
        description: "Основной тип для вкладок каталога.",
      },
    },
    {
      name: "image",
      type: "upload",
      label: "Изображение категории",
      relationTo: "media",
      admin: {
        description: "Фото для отображения в каталоге",
      },
    },
    {
      name: "parent",
      type: "relationship",
      label: "Родительская категория",
      relationTo: "categories",
      filterOptions: ({ siblingData }) => {
        const typeId = getRelationshipId((siblingData as { productTypeRef?: unknown })?.productTypeRef)
        if (!typeId) return true

        return {
          productTypeRef: { equals: typeId },
        }
      },
      admin: {
        description: "Оставьте пустым для корневой категории. Доступны только категории того же типа.",
      },
    },
    {
      name: "description",
      type: "textarea",
      label: "Описание",
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
      label: "Видима в каталоге",
      defaultValue: true,
      admin: {
        position: "sidebar",
      },
    },
  ],
  access: {
    read: () => true,
    create: contentManagerOnly,
    update: contentManagerOnly,
    delete: superAdminOnly,
  },
  hooks: {
    beforeValidate: [ensureSlug({ collection: "categories", sourceField: "name" })],
    beforeChange: [validateCategoryProductType],
  },
}
