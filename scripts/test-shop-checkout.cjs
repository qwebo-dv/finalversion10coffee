/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner */
// Real checkout, React and Radix dialog; catalog, account and network are isolated.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

test('delivery selection survives all notice dismissal paths and reaches order submission', async t => {
  const { Window } = await import('happy-dom')
  const window = new Window({ url: 'http://localhost/checkout' })
  for (const key of ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element',
    'Node', 'NodeFilter', 'MutationObserver', 'CustomEvent', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FormData']) {
    Object.defineProperty(globalThis, key, { configurable: true, value: window[key] })
  }
  globalThis.window = window
  globalThis.getComputedStyle = window.getComputedStyle.bind(window)
  globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const React = require('react')
  const { createRoot } = require('react-dom/client')
  const { act } = React
  const h = React.createElement
  const submissions = []
  const cart = { items: [{ id: 'coffee-kg', productId: 'coffee', variantId: 'kg', quantity: 1 }], hydrated: true,
    pendingPayment: null, clearCart() { throw new Error('Test must not finish an order') }, setPendingPayment() {} }
  const products = [{ id: 'coffee', name: 'Coffee', slug: 'coffee', images: [],
    variants: [{ id: 'kg', name: '1 кг', price: 2570, weight_grams: 1000 }] }]
  const mocks = {
    'next/link': { default: ({ children, ...props }) => h('a', props, children) },
    'next/image': { default: ({ src, alt }) => h('img', { src, alt }) },
    '@/providers/guest-cart-provider': { useGuestCart: () => cart },
    '@/providers/auth-provider': { useAuth: () => ({ user: null }) },
    '@/lib/actions/loyalty': { getMyLoyalty: async () => null },
    '@/lib/actions/shop-orders': {
      createShopOrder: async data => { submissions.push(data); return { error: 'Test stops before saving or payment' } },
      previewShopPersonalDiscount: async () => { throw new Error('Unexpected discount lookup') },
      previewShopPromo: async () => { throw new Error('Unexpected promo lookup') },
      quoteShopSochiDelivery: async () => ({ available: true, cost: 100, zone: 'test' }),
    },
    '@/components/shared/phone-input': { default: ({ onChange, ...props }) => h('input', { ...props, onChange: event => onChange(event.target.value) }) },
    '@/components/shared/address-input': { default: ({ onChange, onCompleteChange }) => h('button', {
      type: 'button', 'data-test-address': true, onClick: () => { onChange('ул. Тестовая, 1'); onCompleteChange(true) },
    }, 'Выбрать тестовый адрес') },
    '@/components/shop/pending-payment-card': { PendingPaymentCard: () => null },
    './cdek-delivery-selector': { CdekDeliverySelector: () => h('div', { 'data-test-carrier': 'cdek' }) },
    './yandex-delivery-selector': { YandexDeliverySelector: () => h('div', { 'data-test-carrier': 'yandex' }) },
  }
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const mod = { exports: {} }
    modules.set(file, mod)
    const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (id.startsWith('@/')) {
        const filename = id.slice(2)
        return load(filename + (fs.existsSync(path.join(root, filename + '.tsx')) ? '.tsx' : '.ts'))
      }
      return require(id)
    }
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(localRequire, mod, mod.exports)
    return mod.exports
  }
  const { ShopCheckout } = load('components/shop/shop-checkout.tsx')
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  const deliveryButton = (container, label) => Array.from(container.querySelectorAll('fieldset button')).find(button => button.textContent.includes(label))

  try {
    for (const method of ['sochi_delivery', 'self_pickup']) {
      for (const dismissal of ['close button', 'Escape', 'backdrop']) {
        await t.test(`${method}: ${dismissal}`, async () => {
          const container = document.createElement('div')
          document.body.append(container)
          const reactRoot = createRoot(container)
          try {
            await act(async () => { reactRoot.render(h(ShopCheckout, { products, onlinePaymentReady: false })) })
            const button = deliveryButton(container, method === 'self_pickup' ? 'Самовывоз' : 'По Сочи')
            await act(async () => { button.click(); await pause(10) })
            assert.ok(document.querySelector('[role="dialog"]'), 'notice must open')
            assert.equal(button.getAttribute('aria-pressed'), 'true', 'click selects the delivery immediately')
            await act(async () => {
              if (dismissal === 'close button') document.querySelector('[data-slot="dialog-close"]').click()
              else if (dismissal === 'Escape') document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
              else {
                const overlay = document.querySelector('[data-slot="dialog-overlay"]')
                overlay.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }))
                overlay.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', button: 0 }))
                overlay.click()
              }
              await pause(10)
            })
            assert.ok(!document.querySelector('[role="dialog"]'), 'notice must close')
            assert.equal(button.getAttribute('aria-pressed'), 'true', 'dismissal preserves the selected method')
            assert.ok(!container.querySelector('[data-test-carrier]'))
            assert.notEqual(document.body.style.pointerEvents, 'none', 'dialog must release page interaction')
            if (method === 'self_pickup') assert.match(container.textContent, /Адрес самовывоза/)
            else {
              assert.match(container.textContent, /Адрес доставки/)
              await act(async () => { container.querySelector('[data-test-address]').click() })
              await act(async () => { await pause(400) })
            }
            const before = submissions.length
            await act(async () => { container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })) })
            assert.equal(submissions.length, before + 1, 'delivery validation permits submission')
            assert.equal(submissions.at(-1).deliveryMethod, method)
            assert.equal(submissions.at(-1).deliveryCost, method === 'self_pickup' ? 0 : 100)
            await act(async () => { container.querySelectorAll('fieldset button')[1].click() })
            assert.ok(container.querySelector('[data-test-carrier="yandex"]'))
            assert.ok(!document.querySelector('[role="dialog"]'))
            await act(async () => { container.querySelectorAll('fieldset button')[0].click() })
            assert.ok(container.querySelector('[data-test-carrier="cdek"]'))
          } finally {
            await act(async () => { reactRoot.unmount() })
            container.remove()
          }
        })
      }
    }
  } finally { await window.happyDOM.close() }
})
