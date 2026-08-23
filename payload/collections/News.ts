import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"
import { revalidatePath, revalidateTag } from "next/cache"
import { ensureSlug } from "../hooks/ensureSlug"

export const News: CollectionConfig = {
  slug: "news",
  admin: {
    useAsTitle: "title",
    group: "Контент",
    description: "Новости и объявления для клиентов",
    defaultColumns: ["title", "isPublished", "publishedAt", "createdAt"],
  },
  labels: {
    singular: "Новость",
    plural: "Новости",
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "Заголовок",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      label: "Slug (URL)",
      required: true,
      unique: true,
      admin: {
        components: {
          Field: "/payload/components/SlugField",
        },
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      label: "Краткое описание",
      admin: {
        description: "Короткий текст для предпросмотра",
      },
    },
    {
      name: "content",
      type: "richText",
      label: "Содержание",
      required: true,
    },
    {
      name: "coverImage",
      type: "upload",
      label: "Обложка",
      relationTo: "media",
    },
    {
      name: "isPublished",
      type: "checkbox",
      label: "Опубликовано",
      defaultValue: false,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      label: "Дата публикации",
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        date: {
          pickerAppearance: "dayAndTime",
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
    beforeValidate: [ensureSlug({ collection: "news", sourceField: "title" })],
    beforeChange: [
      ({ data }) => {
        // Auto-set publishedAt when first published
        if (data) {
          const now = new Date()
          // Дата/время публикации подставляются автоматически. Пустое или будущее
          // значение → текущее время; вручную указанная прошедшая дата сохраняется.
          if (!data.publishedAt || new Date(data.publishedAt as string) > now) {
            data.publishedAt = now.toISOString()
          }
        }
        return data
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        if (operation === "update" || operation === "create") {
          try {
            revalidatePath(`/dashboard/news`)
            revalidatePath(`/dashboard/news/${doc.id}`)
            revalidateTag("news-paginated", "max")
          } catch {}
        }
      },
    ],
  },
}
