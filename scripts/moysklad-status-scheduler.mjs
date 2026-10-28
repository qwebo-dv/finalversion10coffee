// Docker does not execute vercel.json schedules. Call the same protected
// endpoint locally; schedule the next run only after the current run finishes.
export function startMoyskladStatusScheduler({
  env = process.env,
  fetchImpl = fetch,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  logger = console,
} = {}) {
  if (!['1', 'true', 'yes', 'on'].includes((env.MOYSKLAD_ENABLED || '').toLowerCase())) return () => {}
  if (!env.CRON_SECRET) {
    logger.error('[MoySklad status scheduler] CRON_SECRET is required; scheduler is disabled')
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
      const response = await fetchImpl(`http://127.0.0.1:${env.PORT || 3000}/api/cron/moysklad-status-sync`, {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
        signal: request.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      if (!result.ok) {
        // Historical order errors must not cause full-sweep retries every
        // minute. The endpoint has already attempted the other linked orders.
        logger.error(`[MoySklad status scheduler] ${result.errors?.length || 0} order errors`)
      } else {
        logger.log(`[MoySklad status scheduler] checked=${result.checked || 0}, synced=${result.synced || 0}`)
      }
    } catch (error) {
      if (!stopped) logger.error('[MoySklad status scheduler]', error instanceof Error ? error.message : 'Request failed')
      delay = 60_000
    } finally {
      request = undefined
      if (!stopped) timer = setTimer(run, delay)
    }
  }
  timer = setTimer(run, 10_000)
  return () => {
    stopped = true
    clearTimer(timer)
    request?.abort()
  }
}
