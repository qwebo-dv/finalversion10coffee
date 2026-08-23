import type { CollectionConfig } from "payload"

import { operationsDeleteAccess, operationsReadAccess, operationsUpdateAccess } from "../access/adminRoles"

export const JobApplications: CollectionConfig = {
  slug: "job-applications",
  labels: {
    singular: "Кандидат",
    plural: "Кандидаты",
  },
  admin: {
    useAsTitle: "name",
    group: "Карьера",
    description: "Отклики и кадровый резерв 10coffee",
    defaultColumns: ["name", "desiredPosition", "email", "phone", "status", "createdAt"],
  },
  access: {
    read: operationsReadAccess,
    create: operationsUpdateAccess,
    update: operationsUpdateAccess,
    delete: operationsDeleteAccess,
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Имя",
      required: true,
    },
    {
      name: "desiredPosition",
      type: "text",
      label: "Желаемая должность",
      required: true,
    },
    {
      type: "row",
      fields: [
        {
          name: "email",
          type: "email",
          label: "Email",
          required: true,
          admin: { width: "50%" },
        },
        {
          name: "phone",
          type: "text",
          label: "Телефон",
          required: true,
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "resume",
      type: "upload",
      relationTo: "job-application-files",
      label: "Резюме",
      required: true,
    },
    {
      name: "status",
      type: "select",
      label: "Статус",
      required: true,
      defaultValue: "new",
      options: [
        { label: "Новый", value: "new" },
        { label: "Связались", value: "contacted" },
        { label: "Кадровый резерв", value: "reserve" },
        { label: "Отклонён", value: "rejected" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "notes",
      type: "textarea",
      label: "Заметки сотрудников",
      admin: { position: "sidebar" },
    },
    {
      name: "consent",
      type: "checkbox",
      label: "Согласие на обработку персональных данных",
      required: true,
      admin: { readOnly: true, position: "sidebar" },
    },
    {
      name: "source",
      type: "text",
      label: "Источник",
      defaultValue: "website",
      admin: { readOnly: true, position: "sidebar" },
    },
  ],
  timestamps: true,
}
