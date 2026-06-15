---
role: test-generator
skill: browser-extension-developer
context7: [/websites/main_vitest_dev, "@vue/test-utils", "@playwright/test", /websites/pinia_vuejs]
---

# Test Agent

**Prime directive**: Read target file + all its imports first. Generate complete runnable tests — no TODOs.

## Two Layers

| Layer | Tool | Path | When |
|---|---|---|---|
| Unit | Vitest + jsdom | `test/unit/**/*.spec.ts` | stores, services, component rendering, error handling |
| E2E | Playwright + Chromium | `test/playwright/**/*.spec.ts` | storage lifecycle, favicon injection, service worker, real browser |

## Standard Browser Mock (copy verbatim — MUST be first statement)

```ts
vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: vi.fn(), remove: vi.fn(), get: vi.fn(), update: vi.fn(),
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated:   { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved:   { addListener: vi.fn(), removeListener: vi.fn() },
    },
    storage: {
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setIcon: vi.fn() },
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() } },
  },
}))
```

## Unit Test Skeleton

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
// ↑ vi.mock() BEFORE this — Vitest hoists it

import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar, QBtn, QTable, QTr, QTd, QTooltip } from 'quasar'

describe('FeatureName › scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()           // always
    setActivePinia(createPinia()) // always when testing stores/components
  })

  it('does X when Y', async () => {
    // Arrange — set up mocks
    // Act — call method or mount component
    // Assert — state/DOM/return value (not implementation calls)
  })
})
```

## Store Tests

```ts
it('sets loading=false and populates on success', async () => {
  const store = useTabStore()
  const { default: browser } = await import('webextension-polyfill')
  vi.mocked(browser.tabs.query).mockResolvedValue([tabWithAge(1, 10)])

  await store.getAllOpenedTabs()

  expect(store.loading).toBe(false)
  expect(store.error).toBeNull()
  expect(store.tabs).toHaveLength(1)
})

it('sets error string on failure', async () => {
  const store = useTabStore()
  const { default: browser } = await import('webextension-polyfill')
  vi.mocked(browser.tabs.query).mockRejectedValueOnce(new Error('Network error'))

  await store.getAllOpenedTabs()

  expect(store.error).toBe('Network error')
  expect(store.loading).toBe(false)
})
```

## Component Mount

```ts
const wrapper = mount(App, {
  global: {
    plugins: [
      createPinia(),
      [Quasar, { components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip } }],
    ],
  },
})
await flushPromises()
// Assert wrapper.text(), wrapper.find(), store state
```

## Helpers

```ts
// Tab factory
function tabWithAge(id: number, daysAgo: number): Tabs.Tab {
  return {
    id, index: id, windowId: 1,
    active: false, highlighted: false, pinned: false, incognito: false,
    lastAccessed: Date.now() - daysAgo * 24 * 60 * 60 * 1000,
    title: `Tab ${id}`, url: `https://example.com/${id}`, status: 'complete',
  } as Tabs.Tab
}

// In-memory storage (reusable across store tests)
function createInMemoryStorage(initial: Record<string, unknown> = {}) {
  const data = { ...initial }
  return {
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(data, items) }),
    remove: vi.fn(async (key: string) => { delete data[key] }),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
  }
}
```

## Playwright E2E

```ts
import { test as base, chromium, expect } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'

const EXT_DIR = path.resolve(process.cwd(), '.output', 'chrome-mv3')

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: false,
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
        '--disable-background-timer-throttling', '--no-first-run',
      ],
    })
    await use(ctx)
    await ctx.close()
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 })
    await use(sw.url().split('/')[2])
  },
})

test.beforeAll(() => {
  if (process.env.SKIP_BUILD !== '1') execSync('npm run build-only', { stdio: 'inherit' })
})
// Page URL: chrome-extension://${extensionId}/popup/index.html
```

## Critical Rules

- `vi.mock(...)` MUST be the very first statement (Vitest hoists it)
- `vi.clearAllMocks()` in every `beforeEach`
- `await flushPromises()` after mounting components with async `onMounted`
- Mock `storage.onChanged` if component calls `initStorageSync()`
- Test **behavior** (state/output), not implementation (method calls)
- No `any` — use `unknown` + narrow, or `as Type`

## Coverage Targets

| Scope | Target |
|---|---|
| Stores | 90% — success + error + loading for every action |
| Services | 95% — happy path + edge cases |
| Components | 70% — mount, key interactions, error display |
| E2E | extension loads · popup mounts · options mounts · content injects |
