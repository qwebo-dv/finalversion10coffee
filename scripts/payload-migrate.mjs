import { spawnSync } from "node:child_process"
import path from "node:path"
import nextEnv from "@next/env"

nextEnv.loadEnvConfig(process.cwd())

const payloadCLI = path.resolve("node_modules/payload/bin.js")
const migrationConfig = path.resolve("payload.migrations.config.ts")
const command = process.argv[2] || "migrate"

// Payload discovers migration files dynamically. Register tsx at the process
// level so production Node versions that do not natively load `.ts` files can
// import them as well as the main migration config.
const result = spawnSync(process.execPath, ["--import", "tsx", payloadCLI, command], {
  stdio: "inherit",
  env: {
    ...process.env,
    PAYLOAD_CONFIG_PATH: migrationConfig,
  },
})

if (result.error) {
  console.error(result.error)
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
