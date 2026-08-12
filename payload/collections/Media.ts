import type { CollectionConfig } from "payload"
import { contentManagerOnly, superAdminOnly } from "../access/adminRoles"

export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    group: "Контент",
    description: "Изображения и файлы",
  },
  labels: {
    singular: "Медиа",
    plural: "Медиа файлы",
  },
  upload: {
    mimeTypes: [
      "image/*",
      "application/pdf",
      "video/mp4",
      "video/webm",
    ],
    imageSizes: [
      {
        name: "thumbnail",
        width: 200,
        height: 200,
        position: "centre",
      },
      {
        name: "card",
        width: 600,
        height: 400,
        position: "centre",
      },
      {
        name: "full",
        width: 1200,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Alt текст",
      admin: {
        description: "Описание изображения для доступности",
      },
    },
  ],
  access: {
    read: () => true,
    create: contentManagerOnly,
    update: contentManagerOnly,
    delete: superAdminOnly,
  },
}
