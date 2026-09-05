/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadConfig = require('next/dist/server/config').default
const { PHASE_PRODUCTION_BUILD } = require('next/constants')
const { ImageOptimizerCache } = require('next/dist/server/image-optimizer')
const imageLoader = require('next/dist/shared/lib/image-loader').default

test('Next image optimizer accepts Payload media prefix without allowing arbitrary query strings', async () => {
  const config = await loadConfig(PHASE_PRODUCTION_BUILD, process.cwd())
  const check = (url, settings = config) => ImageOptimizerCache.validateParams(
    { headers: { accept: 'image/webp' } }, { url, w: '640', q: '75' }, settings, false,
  )
  const media = '/api/media/file/%D0%91%D0%91-1200x1200.jpg?prefix=media%2F'
  const previousImages = { ...config.images, localPatterns: [{ pathname: '**', search: '' }] }

  // Reproduce the production failure with the new framework default.
  assert.equal(check(media, {
    ...config, images: previousImages,
  }).errorMessage, '"url" parameter is not allowed')
  // The same default also throws during page rendering, even in production.
  assert.throws(() => imageLoader({ config: previousImages, src: media, width: 640, quality: 75 }), /query string/)
  assert.match(imageLoader({ config: config.images, src: media, width: 640, quality: 75 }), /^\/_next\/image\?/)

  assert.equal(check(media).errorMessage, undefined)
  assert.equal(check('/api/media/file/coffee.jpg').errorMessage, undefined)
  assert.equal(check('/images/logo.png').errorMessage, undefined)
  assert.equal(check('/api/media/file/coffee.jpg?prefix=job-applications%2F').errorMessage, '"url" parameter is not allowed')
  assert.equal(check('/api/media/file/coffee.jpg?prefix=media%2F&other=1').errorMessage, '"url" parameter is not allowed')
  assert.equal(check('/api/private/file.jpg?prefix=media%2F').errorMessage, '"url" parameter is not allowed')
  assert.equal(config.images.dangerouslyAllowLocalIP, false)
})
