import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startMoyskladStatusScheduler } from './moysklad-status-scheduler.mjs'

function fixture(env = { MOYSKLAD_ENABLED: 'true', CRON_SECRET: 'test-secret', PORT: '3001' }, fetchImpl) {
  const timers = [], calls = [], messages = [], cleared = []
  const stop = startMoyskladStatusScheduler({ env,
    setTimer: (fn, ms) => { const timer = { fn, ms }; timers.push(timer); return timer },
    clearTimer: timer => cleared.push(timer),
    logger: { log: value => messages.push(value), error: (...values) => messages.push(values.join(' ')) },
    fetchImpl: async (...args) => { calls.push(args); return fetchImpl ? fetchImpl(...args)
      : Response.json({ ok: true, checked: 3, synced: 3 }) },
  })
  return { stop, timers, calls, messages, cleared }
}

test('Docker scheduler calls only the protected local status endpoint and waits before the next run', async () => {
  let complete
  const f = fixture(undefined, () => new Promise(resolve => { complete = resolve }))
  const running = f.timers[0].fn()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0][0], 'http://127.0.0.1:3001/api/cron/moysklad-status-sync')
  assert.equal(f.calls[0][1].headers.authorization, 'Bearer test-secret')
  assert.equal(f.timers.length, 1, 'no second timer while the request is running')
  complete(Response.json({ ok: true, checked: 3, synced: 3 }))
  await running
  assert.equal(f.timers[1].ms, 600000)
  assert.ok(f.messages.every(message => !message.includes('test-secret')))
  f.stop()
})

test('disabled integration and missing cron secret make no requests', () => {
  for (const env of [{ MOYSKLAD_ENABLED: 'false', CRON_SECRET: 'test-secret' }, { MOYSKLAD_ENABLED: 'true' }]) {
    const f = fixture(env)
    assert.equal(f.timers.length, 0)
    assert.equal(f.calls.length, 0)
    f.stop()
  }
})

test('HTTP failures retry in one minute; individual order errors retain the full-sweep interval', async () => {
  for (const [response, delay] of [[new Response('', { status: 401 }), 60000], [Response.json({ ok: false, errors: [{}] }), 600000]]) {
    const f = fixture(undefined, async () => response)
    await f.timers[0].fn()
    assert.equal(f.timers[1].ms, delay)
    assert.ok(f.messages.every(message => !message.includes('test-secret')))
    f.stop()
  }
})

test('shutdown aborts an active request and prevents later work', async () => {
  const f = fixture(undefined, (_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')))
  }))
  const running = f.timers[0].fn()
  f.stop()
  await running
  assert.equal(f.calls[0][1].signal.aborted, true)
  assert.equal(f.timers.length, 1)
  await f.timers[0].fn()
  assert.equal(f.calls.length, 1)
})
