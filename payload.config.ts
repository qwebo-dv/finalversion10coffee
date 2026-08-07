import path from "path"
import { buildConfig } from "payload"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from "@payloadcms/richtext-lexical"
import { s3Storage } from "@payloadcms/storage-s3"
import { ru } from "@payloadcms/translations/languages/ru"
import type { EmailAdapter, SendEmailOptions } from "payload"
import nodemailer from "nodemailer"
import sharp from "sharp"
import { ensureProductDiscountSchema } from "./migrations/20260805_172254_product_discounts"
import { ensureProductReviewsSchema } from "./migrations/20260806_172254_product_reviews"

import { Categories } from "./payload/collections/Categories"
import { ProductTypes } from "./payload/collections/ProductTypes"
import { Products } from "./payload/collections/Products"
import { ProductReviews } from "./payload/collections/ProductReviews"
import { Orders } from "./payload/collections/Orders"
import { PromoCodes } from "./payload/collections/PromoCodes"
import { News } from "./payload/collections/News"
import { Admins } from "./payload/collections/Admins"
import { Clients } from "./payload/collections/Clients"
import { Media } from "./payload/collections/Media"
import { CartItems } from "./payload/collections/CartItems"
import { Favorites } from "./payload/collections/Favorites"
import { MapLocations } from "./payload/collections/MapLocations"
import { BlogPosts } from "./payload/collections/BlogPosts"
import { Tags } from "./payload/collections/Tags"
import { PriceListRequests } from "./payload/collections/PriceListRequests"
import { SiteSettings } from "./payload/globals/SiteSettings"
import { businessDashboardHandler } from "./payload/endpoints/businessDashboard"

const smtpEmailAdapter: EmailAdapter = () => {
  const defaultFromAddress = process.env.SMTP_EMAIL || "noreply@10coffee.ru"
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  })

  return {
    name: "smtp",
    defaultFromAddress,
    defaultFromName: "10coffee",
    sendEmail: (message: SendEmailOptions) =>
      transporter.sendMail({
        ...message,
        from: message.from || `"10coffee" <${defaultFromAddress}>`,
      }),
  }
}

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "",

  onInit: async (payload) => {
    if (process.env.NEXT_PHASE === "phase-production-build") return
    await ensureProductDiscountSchema(payload.db.drizzle)
    await ensureProductReviewsSchema(payload.db.drizzle)
  },

  admin: {
    user: Admins.slug,
    meta: {
      titleSuffix: " — 10coffee",
      description: "Панель управления 10coffee",
    },
    dateFormat: "dd.MM.yyyy HH:mm",
    components: {
      beforeDashboard: ["/payload/components/BusinessDashboard"],
    },
  },

  collections: [
    Orders,
    PriceListRequests,
    PromoCodes,
    Clients,
    CartItems,
    Favorites,
    Tags,
    ProductTypes,
    Products,
    ProductReviews,
    Categories,
    News,
    MapLocations,
    BlogPosts,
    Media,
    Admins,
  ],

  globals: [SiteSettings],

  editor: lexicalEditor({
    admin: {
      placeholder: "Добавьте описание: заголовки, жирный текст, списки, ссылки...",
    },
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.map((feature) =>
        feature.key === "heading"
          ? HeadingFeature({ enabledHeadingSizes: ["h1", "h2", "h3", "h4", "h5", "h6"] })
          : feature
      ),
      FixedToolbarFeature(),
    ],
  }),

  email: smtpEmailAdapter,

  secret: process.env.PAYLOAD_SECRET || "your-secret-key-change-this",

  endpoints: [
    {
      path: "/business-dashboard",
      method: "get",
      handler: businessDashboardHandler,
    },
  ],

  typescript: {
    outputFile: path.resolve(__dirname, "payload-types.ts"),
  },

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
    push: true,
  }),

  sharp,

  plugins: [
    s3Storage({
      collections: {
        media: { prefix: "media/" },
      },
      bucket: process.env.S3_BUCKET || "placeholder",
      config: {
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
        },
        region: process.env.S3_REGION || "us-east-1",
        forcePathStyle: true,
      },
      ...(process.env.S3_BUCKET ? {} : { enabled: false }),
    }),
  ],

  localization: {
    locales: [{ label: "Русский", code: "ru" }],
    defaultLocale: "ru",
  },

  i18n: {
    supportedLanguages: { ru },
    fallbackLanguage: "ru",
  },
})
