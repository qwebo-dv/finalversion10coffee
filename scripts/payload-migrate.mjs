import { spawnSync } from "node:child_process"
import path from "node:path"

const payloadCLI = path.resolve("node_modules/payload/bin.js")
const migrationConfig = path.resolve("payload.migrations.config.ts")
const command = process.argv[2] || "migrate"

const result = spawnSync(process.execPath, [payloadCLI, command], {
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
