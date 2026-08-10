import type { CollectionConfig } from "payload"
import { adminOnly } from "../access/adminOnly"
import { favoritesAnalyticsHandler } from "../endpoints/favoritesAnalytics"

export const Favorites: CollectionConfig = {
  slug: "favorites",
  defaultSort: "-createdAt",
  admin: {
    group: "Клиенты",
    description: "Избранные товары клиентов",
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
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
}
