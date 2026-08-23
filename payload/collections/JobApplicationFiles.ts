import type { CollectionConfig } from "payload"

import { operationsDeleteAccess, operationsReadAccess, operationsUpdateAccess } from "../access/adminRoles"

export const JobApplicationFiles: CollectionConfig = {
  slug: "job-application-files",
  labels: {
    singular: "Резюме кандидата",
    plural: "Резюме кандидатов",
  },
  admin: {
    useAsTitle: "title",
    group: "Карьера",
    description: "Закрытое хранилище резюме. Файлы доступны только сотрудникам.",
    defaultColumns: ["title", "filename", "createdAt"],
  },
  upload: {
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  access: {
    read: operationsReadAccess,
    create: operationsUpdateAccess,
    update: operationsUpdateAccess,
    delete: operationsDeleteAccess,
  },
  fields: [
    {
      name: "title",
      type: "text",
      label: "Кандидат и должность",
      required: true,
    },
  ],
}
