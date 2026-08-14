import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"
import { ensureSlug } from "../hooks/ensureSlug"

export const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: "name",
    group: "Каталог",
    description: "Теги товаров — создавайте и применяйте к товарам",
    defaultColumns: ["name", "slug", "color"],
  },
  labels: {
    singular: "Тег",
    plural: "Теги",
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Название тега",
      required: true,
      admin: {
        description: "Например: Новинка, Хит продаж, Скидка месяца",
      },
    },
    {
      name: "slug",
      type: "text",
      label: "Идентификатор (slug)",
      required: true,
      unique: true,
      admin: {
        description: "Только латиница, цифры, дефис. Например: new, popular, sale",
        components: {
          Field: "/payload/components/SlugField",
        },
      },
    },
    {
      name: "color",
      type: "text",
      label: "Цвет",
      defaultValue: "#e6610d",
      admin: {
        position: "sidebar",
        components: {
          Field: "/payload/components/ColorPickerField",
        },
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
    beforeValidate: [ensureSlug({ collection: "tags", sourceField: "name" })],
  },
}
