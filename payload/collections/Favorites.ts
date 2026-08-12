import type { CollectionConfig } from "payload"
import { canReadOperations, operationsDeleteAccess } from "../access/adminRoles"
import { favoritesAnalyticsHandler } from "../endpoints/favoritesAnalytics"
import { retailOnlyBaseFilter } from "../admin/workspace"

export const Favorites: CollectionConfig = {
  slug: "favorites",
  defaultSort: "-createdAt",
  admin: {
    group: "Клиенты",
    description: "Избранные товары клиентов",
    baseFilter: retailOnlyBaseFilter,
    defaultColumns: ["clientId", "product", "createdAt"],
    components: {
      beforeList: ["/payload/components/FavoritesAnalyticsDashboard"],
    },
  },
  labels: {
    singular: "Избранное",
    plural: "Избранные",
  },
  fields: [
    {
      name: "clientId",
      type: "text",
      label: "ID клиента (Supabase)",
      required: true,
      index: true,
    },
    {
      name: "product",
      type: "relationship",
      label: "Товар",
      relationTo: "products",
      required: true,
    },
  ],
  endpoints: [
    {
      path: "/analytics",
      method: "get",
      handler: favoritesAnalyticsHandler,
    },
  ],
  access: {
    read: ({ req }) => canReadOperations(req.user),
    create: () => false,
    update: () => false,
    delete: operationsDeleteAccess,
  },
}
