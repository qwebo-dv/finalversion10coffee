import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"
import { revalidatePath, revalidateTag } from "next/cache"
import { ensureSlug } from "../hooks/ensureSlug"

export const BlogPosts: CollectionConfig = {
  slug: "blog_posts",
  admin: {
    useAsTitle: "title",
    group: "Контент",
    description: "Статьи блога для публичной страницы /blog",
    defaultColumns: ["title", "isPublished", "publishedAt", "createdAt"],
  },
  labels: {
    singular: "Статья блога",
    plural: "Блог",
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
        description: "Короткий текст для предпросмотра на странице блога",
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
    beforeValidate: [ensureSlug({ collection: "blog_posts", sourceField: "title" })],
    beforeChange: [
      ({ data }) => {
        if (data) {
          const now = new Date()
          if (!data.publishedAt || new Date(data.publishedAt as string) > now) {
            data.publishedAt = now.toISOString()
          }
        }
        return data
      },
    ],
    afterChange: [
      ({ doc }) => {
        try {
          revalidatePath("/dashboard/blog")
          revalidatePath(`/dashboard/blog/${doc.id}`)
          revalidateTag("blog-posts-paginated")
        } catch {}
      },
    ],
  },
}
