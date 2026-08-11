// Keep this file valid plain JavaScript even though it uses a .ts extension.
// Some production Node 22 builds load the Payload config before TS transforms.
import { postgresAdapter } from "@payloadcms/db-postgres"
import { buildConfig } from "payload"

const databaseUrl = process.env.DATABASE_URL?.trim()
const payloadSecret = process.env.PAYLOAD_SECRET?.trim()
if (!databaseUrl) throw new Error("DATABASE_URL is required")
if (!payloadSecret) throw new Error("PAYLOAD_SECRET is required")

/**
 * Dependency-light config for Payload's migration CLI.
 *
 * The application config imports Next.js modules through the @ alias, which
 * Node's standalone ESM loader cannot resolve reliably on Windows. Migrations
 * must remain runnable independently from the web application module graph.
 */
export default buildConfig({
  secret: payloadSecret,
  collections: [],
  db: postgresAdapter({
    pool: { connectionString: databaseUrl },
    push: false,
  }),
})
