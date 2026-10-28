import { spawnSync } from 'node:child_process'
import nextEnv from '@next/env'

const command = process.argv[2]
const scripts = { relink: 'scripts/relink-moysklad-order.ts', retry: 'scripts/retry-moysklad-orders.ts', statuses: 'scripts/sync-moysklad-order-statuses.ts' }
if (!Object.hasOwn(scripts, command)) {
  console.error('Usage: node scripts/moysklad-maintenance.mjs relink|retry|statuses [options]')
  process.exitCode = 1
} else {
  nextEnv.loadEnvConfig(process.cwd())
  const result = spawnSync(process.execPath, ['--require', './scripts/os-userinfo-workaround.cjs', '--import', 'tsx', scripts[command], ...process.argv.slice(3)], { stdio: 'inherit', env: process.env })
  if (result.error) console.error(result.error.message)
  process.exitCode = result.status ?? 1
}
