import { runMoyskladStatusProcess } from './moysklad-status-process.mjs'

// Schedule the verified CLI procedure, without depending on an HTTP listener
// or the external cron's secret. Never overlap workers in this process.
export function startMoyskladStatusScheduler({
  env = process.env,
  runSync = runMoyskladStatusProcess,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console,
} = {}) {
  if (!['1', 'true', 'yes', 'on'].includes((env.MOYSKLAD_ENABLED || '').toLowerCase())) {
    logger.log('[MoySklad status scheduler] disabled: MOYSKLAD_ENABLED is not enabled')
    return () => {}
  }
  let stopped = false
  let timer
  let request
  const run = async () => {
    if (stopped) return
    let delay = 10 * 60_000
    request = new AbortController()
    try {
      logger.log('[MoySklad status scheduler] starting status import')
      const result = await runSync({ env, signal: request.signal })
      if (!result.ok) {
        // Historical order errors must not cause full-sweep retries every
        // minute. The worker has already attempted the other linked orders.
        logger.error(`[MoySklad status scheduler] import failed; worker exit code ${result.exitCode}`)
      } else {
        logger.log('[MoySklad status scheduler] status import completed')
      }
    } catch (error) {
      if (!stopped) logger.error('[MoySklad status scheduler]', error instanceof Error ? error.message : 'Worker failed')
      delay = 60_000
    } finally {
      request = undefined
      if (!stopped) timer = setTimer(run, delay)
    }
  }
  logger.log('[MoySklad status scheduler] enabled: first import in 10 seconds; interval 10 minutes after completion')
  timer = setTimer(run, 10_000)
  return () => {
    stopped = true
    clearTimer(timer)
    request?.abort()
  }
}
