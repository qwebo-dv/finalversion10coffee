import type { CollectionConfig } from "payload"
import { isStaffUser, isSuperAdmin } from "../access/adminRoles"

function normalizeWorkspaceAccess(data: Record<string, unknown>) {
  const role = data.role
  if (role === "admin" || role === "super_admin" || role === "manager" || role === "content_manager" || role === "support" || role === "integration_operator") {
    data.canAccessWholesale = true
    data.canAccessRetail = true
  } else if (role === "wholesale_manager") {
    data.canAccessWholesale = true
    data.canAccessRetail = false
  } else if (role === "retail_manager") {
    data.canAccessWholesale = false
    data.canAccessRetail = true
  }
  return data
}

export const Admins: CollectionConfig = {
  slug: "admins",
  auth: true,
  admin: {
    useAsTitle: "fullName",
    group: "Администрирование",
    description: "Администраторы и менеджеры платформы",
  },
  labels: {
    singular: "Администратор",
    plural: "Администраторы",
  },
  fields: [
    {
      name: "fullName",
      type: "text",
      label: "ФИО",
      required: true,
    },
    {
      name: "role",
      type: "select",
      label: "Роль",
      required: true,
      defaultValue: "manager",
      options: [
        { label: "Администратор", value: "admin" },
        { label: "Менеджер", value: "manager" },
        { label: "Суперадминистратор", value: "super_admin" },
        { label: "Контент-менеджер", value: "content_manager" },
        { label: "Менеджер опта", value: "wholesale_manager" },
        { label: "Менеджер розницы", value: "retail_manager" },
        { label: "Поддержка", value: "support" },
        { label: "Оператор интеграций", value: "integration_operator" },
      ],
      access: {
        update: ({ req }) => isSuperAdmin(req.user),
      },
    },
    {
      name: "canAccessWholesale",
      type: "checkbox",
      label: "Доступ к оптовому контуру",
      defaultValue: true,
      admin: {
        position: "sidebar",
        description: "Используется для фильтрации заказов, клиентов и аналитики.",
      },
      access: { update: ({ req }) => isSuperAdmin(req.user) },
    },
    {
      name: "canAccessRetail",
      type: "checkbox",
      label: "Доступ к розничному контуру",
      defaultValue: true,
      admin: {
        position: "sidebar",
        description: "Используется для фильтрации заказов, покупателей и аналитики.",
      },
      access: { update: ({ req }) => isSuperAdmin(req.user) },
    },
  ],
  hooks: {
    beforeValidate: [({ data }) => data ? normalizeWorkspaceAccess(data) : data],
  },
  access: {
    unlock: ({ req }) => isSuperAdmin(req.user),
    admin: ({ req }) => isStaffUser(req.user),
    read: ({ req }) => isSuperAdmin(req.user)
      ? true
      : isStaffUser(req.user) && req.user?.id
        ? { id: { equals: req.user.id } }
        : false,
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user)
      ? true
      : isStaffUser(req.user) && req.user?.id
        ? { id: { equals: req.user.id } }
        : false,
    delete: ({ req }) => isSuperAdmin(req.user),
  },
}
