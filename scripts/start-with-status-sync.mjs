import { spawn } from 'node:child_process'
import { startMoyskladStatusScheduler } from './moysklad-status-scheduler.mjs'

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start'], {
  stdio: 'inherit',
  env: process.env,
})
const stopScheduler = startMoyskladStatusScheduler()
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopScheduler()
    server.kill(signal)
  })
}
server.on('error', (error) => {
  stopScheduler()
  console.error('[Next.js]', error.message)
  process.exitCode = 1
})
server.on('exit', (code, signal) => {
  stopScheduler()
  process.exitCode = code ?? (signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1)
})
