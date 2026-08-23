import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"
import { revalidatePath } from "next/cache"

export const Faqs: CollectionConfig = {
  slug: "faqs",
  admin: {
    useAsTitle: "question",
    group: "Контент",
    description: "Вопросы с сайта и ответы для публичного раздела FAQ",
    defaultColumns: ["question", "status", "source", "email", "updatedAt"],
  },
  labels: {
    singular: "Вопрос и ответ",
    plural: "FAQ",
  },
  access: {
    read: ({ req }) => contentManagerOnly({ req }) || { status: { equals: "published" } },
    create: contentManagerOnly,
    update: contentManagerOnly,
    delete: superAdminOnly,
  },
  fields: [
    {
      name: "question",
      type: "textarea",
      label: "Вопрос",
      required: true,
      maxLength: 1000,
    },
    {
      name: "answer",
      type: "textarea",
      label: "Ответ",
      maxLength: 5000,
      validate: (value, { siblingData }) => {
        const status = (siblingData as { status?: unknown } | undefined)?.status
        if (status === "published" && !String(value || "").trim()) {
          return "Для публикации FAQ заполните ответ."
        }
        return true
      },
      admin: {
        description: "Для публикации вопроса с сайта заполните ответ и выберите статус «Опубликован».",
      },
    },
    {
      name: "status",
      type: "select",
      label: "Статус",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "На модерации", value: "pending" },
        { label: "Опубликован", value: "published" },
        { label: "Отклонён", value: "rejected" },
      ],
      admin: {
        position: "sidebar",
        description: "На сайте видны только опубликованные записи с заполненным ответом.",
      },
    },
    {
      name: "source",
      type: "select",
      label: "Источник",
      required: true,
      defaultValue: "manual",
      options: [
        { label: "Добавлено в админке", value: "manual" },
        { label: "Вопрос с сайта", value: "website" },
      ],
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "name",
          type: "text",
          label: "Имя отправителя",
          admin: { width: "50%" },
        },
        {
          name: "email",
          type: "email",
          label: "Email для ответа",
          admin: { width: "50%" },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      () => {
        try {
          revalidatePath("/shop")
          revalidatePath("/faq")
        } catch {}
      },
    ],
    afterDelete: [
      () => {
        try {
          revalidatePath("/shop")
          revalidatePath("/faq")
        } catch {}
      },
    ],
  },
  timestamps: true,
}
