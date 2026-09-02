import type { CollectionConfig } from "payload"
import { operationsCreateAccess, operationsDeleteAccess, operationsReadAccess, operationsUpdateAccess } from "../access/adminRoles"
import { workspaceBaseFilter } from "../admin/workspace"

interface SupabaseCompanyRow {
  id?: string | number
  name?: string
  inn?: string
  kpp?: string | null
  ogrn?: string | null
  legal_address?: string | null
  bank_name?: string | null
  bik?: string | null
  settlement_account?: string | null
  correspondent_account?: string | null
}

interface PayloadCompanyRow {
  name?: string
  inn?: string
  kpp?: string | null
  ogrn?: string | null
  legalAddress?: string | null
  bankName?: string | null
  bik?: string | null
  settlementAccount?: string | null
  correspondentAccount?: string | null
}

export const Clients: CollectionConfig = {
  slug: "clients",
  admin: {
    useAsTitle: "fullName",
    group: "Клиенты",
    description: "Клиенты платформы",
    baseFilter: workspaceBaseFilter,
    listSearchableFields: ["fullName", "email", "phone"],
    defaultColumns: ["fullName", "salesChannel", "customerType", "email", "phone", "createdAt"],
  },
  labels: {
    singular: "Клиент",
    plural: "Клиенты",
  },
  fields: [
    // === Sidebar ===
    {
      name: "salesChannel",
      type: "select",
      label: "Основной контур",
      required: true,
      defaultValue: "wholesale",
      index: true,
      options: [
        { label: "Опт", value: "wholesale" },
        { label: "Розница", value: "retail" },
      ],
      admin: {
        position: "sidebar",
        description: "Используется для разделения клиентских кабинетов и административных списков.",
      },
    },
    {
      name: "customerType",
      type: "select",
      label: "Тип клиента",
      required: true,
      defaultValue: "business",
      index: true,
      options: [
        { label: "Физическое лицо", value: "individual" },
        { label: "Юридическое лицо / оптовик", value: "business" },
      ],
      admin: {
        position: "sidebar",
        description: "Существующие клиенты считаются юридическими лицами. Розничная регистрация создаёт физлицо.",
      },
    },
    {
      name: "supabaseId",
      type: "text",
      label: "Supabase User ID",
      admin: {
        readOnly: true,
        position: "sidebar",
      },
    },
    {
      name: "moyskladCounterpartyId",
      type: "text",
      label: "ID контрагента в МойСклад",
      admin: {
        position: "sidebar",
        description: "Заполняется автоматически при первой синхронизации или вручную для привязки существующего контрагента.",
      },
    },
    {
      name: "isVerified",
      type: "checkbox",
      label: "Верифицирован",
      defaultValue: false,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "discountPercent",
      type: "number",
      label: "Скидка (%)",
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: {
        position: "sidebar",
        description: "Персональная скидка клиента на все заказы",
      },
    },

    // === Main content (tabs) ===
    {
      type: "tabs",
      tabs: [
        {
          label: "Контакты",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "fullName",
                  type: "text",
                  label: "ФИО",
                  required: true,
                  admin: { width: "40%" },
                },
                {
                  name: "email",
                  type: "email",
                  label: "Email",
                  required: true,
                  unique: true,
                  admin: { width: "30%" },
                },
                {
                  name: "phone",
                  type: "text",
                  label: "Телефон",
                  admin: { width: "30%" },
                },
              ],
            },
            {
              name: "address",
              type: "text",
              label: "Адрес",
              admin: {
                description: "Основной адрес физлица или контактный адрес представителя компании.",
              },
            },
            {
              name: "notes",
              type: "textarea",
              label: "Заметки менеджера",
              admin: {
                description: "Видны только в админ-панели",
              },
            },
          ],
        },
        {
          label: "Компании",
          fields: [
            {
              name: "companies",
              type: "array",
              label: "Компании",
              labels: { singular: "Компания", plural: "Компании" },
              admin: {
                condition: (data) => data?.customerType !== "individual",
                description: "Доступно только для юридических лиц и оптовиков.",
              },
              fields: [
                { name: "name", type: "text", label: "Название" },
                {
                  type: "row",
                  fields: [
                    { name: "inn", type: "text", label: "ИНН", admin: { width: "33%" } },
                    { name: "kpp", type: "text", label: "КПП", admin: { width: "33%" } },
                    { name: "ogrn", type: "text", label: "ОГРН", admin: { width: "34%" } },
                  ],
                },
                { name: "legalAddress", type: "text", label: "Юр. адрес" },
                {
                  type: "collapsible",
                  label: "Банковские реквизиты",
                  admin: { initCollapsed: true },
                  fields: [
                    { name: "bankName", type: "text", label: "Банк" },
                    {
                      type: "row",
                      fields: [
                        { name: "bik", type: "text", label: "БИК", admin: { width: "33%" } },
                        { name: "settlementAccount", type: "text", label: "Расч. счёт", admin: { width: "33%" } },
                        { name: "correspondentAccount", type: "text", label: "Корр. счёт", admin: { width: "34%" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Заказы",
          fields: [
            {
              name: "orders",
              type: "join",
              collection: "orders",
              on: "client",
              label: "Заказы клиента",
              admin: {
                description: "Все заказы этого клиента",
              },
            },
          ],
        },
        {
          label: "Промокоды",
          fields: [
            {
              name: "promoCodes",
              type: "relationship",
              relationTo: "promo-codes",
              hasMany: true,
              label: "Промокоды клиента",
              admin: {
                description: "Выберите один или несколько промокодов из раздела «Промокоды».",
              },
            },
            {
              name: "issuePromo",
              type: "ui",
              admin: {
                components: {
                  Field: "/payload/components/IssuePromoButton",
                },
              },
            },
          ],
        },
        {
          label: "Скидки",
          fields: [
            {
              name: "categoryDiscounts",
              type: "array",
              label: "Скидки по категориям",
              labels: {
                singular: "Скидка по категории",
                plural: "Скидки по категориям",
              },
              admin: {
                description: "Работает только для выбранной категории. Подкатегории не наследуют скидку автоматически.",
              },
              fields: [
                {
                  name: "category",
                  type: "relationship",
                  label: "Категория",
                  relationTo: "categories",
                  required: true,
                  admin: {
                    width: "70%",
                  },
                },
                {
                  name: "discountPercent",
                  type: "number",
                  label: "Скидка (%)",
                  required: true,
                  min: 0,
                  max: 100,
                  admin: {
                    width: "30%",
                  },
                },
              ],
            },
            {
              name: "productDiscounts",
              type: "array",
              label: "Скидки по товарам",
              labels: {
                singular: "Скидка по товарам",
                plural: "Скидки по товарам",
              },
              admin: {
                description: "Выберите один или несколько товаров из любых категорий. Товарная скидка имеет приоритет над скидкой категории и общей скидкой клиента.",
              },
              fields: [
                {
                  name: "products",
                  type: "relationship",
                  label: "Товары",
                  relationTo: "products",
                  hasMany: true,
                  required: true,
                  admin: {
                    width: "70%",
                    description: "Можно выбрать несколько товаров из разных категорий.",
                  },
                },
                {
                  name: "discountPercent",
                  type: "number",
                  label: "Скидка (%)",
                  required: true,
                  min: 0,
                  max: 100,
                  admin: {
                    width: "30%",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation === "create" && data && !data.salesChannel) {
          data.salesChannel = data.customerType === "individual" ? "retail" : "wholesale"
        }
        return data
      },
    ],
    afterRead: [
      async ({ doc }) => {
        doc.customerType = doc.customerType || "business"
        // Always merge companies from Supabase companies table
        if (doc.supabaseId && doc.customerType !== "individual") {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin")
            const admin = createAdminClient()
            const { data } = await admin
              .from("companies")
              .select("*")
              .eq("client_id", doc.supabaseId)
              .order("created_at", { ascending: false })

            if (data && data.length > 0) {
              const supabaseCompanies = (data as SupabaseCompanyRow[]).map((c) => ({
                name: c.name,
                inn: c.inn,
                kpp: c.kpp,
                ogrn: c.ogrn,
                legalAddress: c.legal_address,
                bankName: c.bank_name,
                bik: c.bik,
                settlementAccount: c.settlement_account,
                correspondentAccount: c.correspondent_account,
              }))

              // Merge: Payload companies + Supabase companies (deduplicate by INN)
              const payloadCompanies = (doc.companies || []) as PayloadCompanyRow[]
              const existingInns = new Set(payloadCompanies.map((c) => c.inn).filter(Boolean))
              const newFromSupabase = supabaseCompanies.filter((c) => !existingInns.has(c.inn))
              doc.companies = [...payloadCompanies, ...newFromSupabase]
            }
          } catch {
            // Supabase not available
          }
        }
        return doc
      },
    ],
    afterChange: [
      async ({ doc }) => {
        // Sync Payload companies → Supabase (add new + delete removed)
        if (doc.supabaseId && doc.customerType !== "individual") {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin")
            const admin = createAdminClient()

            const { data: existing } = await admin
              .from("companies")
              .select("id, inn")
              .eq("client_id", doc.supabaseId)

            const existingInns = new Set(((existing || []) as SupabaseCompanyRow[]).map((c) => c.inn))
            const payloadInns = new Set(((doc.companies || []) as PayloadCompanyRow[]).map((c) => c.inn).filter(Boolean))

            // Add new companies to Supabase
            for (const company of (doc.companies || [])) {
              if (company.inn && !existingInns.has(company.inn)) {
                await admin.from("companies").insert({
                  client_id: doc.supabaseId,
                  name: company.name || "",
                  inn: company.inn,
                  kpp: company.kpp || null,
                  ogrn: company.ogrn || null,
                  legal_address: company.legalAddress || null,
                  bank_name: company.bankName || null,
                  bik: company.bik || null,
                  settlement_account: company.settlementAccount || null,
                  correspondent_account: company.correspondentAccount || null,
                })
              }
            }

            // Delete companies from Supabase that were removed in Payload
            for (const ex of (existing || [])) {
              if (ex.inn && !payloadInns.has(ex.inn)) {
                await admin.from("companies").delete().eq("id", ex.id)
              }
            }
          } catch {
            // Supabase not available
          }
        }
      },
    ],
  },
  access: {
    read: operationsReadAccess,
    create: operationsCreateAccess,
    update: operationsUpdateAccess,
    delete: operationsDeleteAccess,
  },
}
