import { postgresAdapter } from "@payloadcms/db-postgres"
import * as nextEnvModule from "@next/env"
import { buildConfig } from "payload"
import { migrations } from "./migrations/index.ts"

const nextEnv = nextEnvModule as typeof nextEnvModule & {
  default?: typeof nextEnvModule
}
const loadEnvConfig = nextEnv.loadEnvConfig || nextEnv.default?.loadEnvConfig
if (!loadEnvConfig) throw new Error("Unable to load Next.js environment configuration")
loadEnvConfig(process.cwd())

function requiredEnv(name: "DATABASE_URL" | "PAYLOAD_SECRET"): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

/**
 * Dependency-light config for Payload's migration CLI.
 *
 * The application config imports Next.js modules through the @ alias, which
 * Node's standalone ESM loader cannot resolve reliably on Windows. Migrations
 * must remain runnable independently from the web application module graph.
 */
export default buildConfig({
  secret: requiredEnv("PAYLOAD_SECRET"),
  collections: [],
  db: postgresAdapter({
    pool: { connectionString: requiredEnv("DATABASE_URL") },
    push: false,
    prodMigrations: migrations,
  }),
})
