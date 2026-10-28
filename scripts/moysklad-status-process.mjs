import { spawn } from 'node:child_process'

// Use the same TypeScript entrypoint as the verified maintenance command.
// A separate process keeps Payload initialization out of the startup wrapper.
export function runMoyskladStatusProcess({ env = process.env, signal, spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const worker = spawnImpl(process.execPath, [
      '--require', './scripts/os-userinfo-workaround.cjs', '--import', 'tsx',
      'scripts/sync-moysklad-order-statuses.ts',
    ], { env, stdio: 'inherit', signal })
    worker.once('error', reject)
    worker.once('close', (code, exitSignal) => {
      if (exitSignal) reject(new Error(`Status worker stopped by ${exitSignal}`))
      else resolve({ ok: code === 0, exitCode: code })
    })
  })
}
