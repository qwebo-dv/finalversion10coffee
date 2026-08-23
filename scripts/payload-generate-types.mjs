import { spawnSync } from "node:child_process"
import path from "node:path"
import nextEnv from "@next/env"

nextEnv.loadEnvConfig(process.cwd())

const payloadCLI = path.resolve("node_modules/payload/bin.js")
const windowsUserInfoWorkaround = path.resolve("scripts/os-userinfo-workaround.cjs")
const result = spawnSync(
  process.execPath,
  ["--require", windowsUserInfoWorkaround, "--import", "tsx", payloadCLI, "generate:types"],
  { stdio: "inherit", env: process.env },
)

if (result.error) {
  console.error(result.error)
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
