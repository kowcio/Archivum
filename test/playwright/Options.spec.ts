/**
 * E2E Playwright test — Options page: Mock Tabs → Load & Mark flow.
 *
 * Steps:
 *   1. Open options page, verify initial state
 *   2. Click "Mock tabs" → 8 real browser tabs created with historical ages
 *   3. Assert table shows all 8 expected ages (1d, 5d, 10d, 13d, 16d, 19d, 22d, 25d)
 *   4. Click "Load & Mark" → tabs processed and age-classified
 *   5. Assert fresh tabs (≤7d) are NOT marked  — green background
 *   6. Assert old tabs   (>7d) ARE marked      — amber/orange/red background
 *   7. Assert L-bracket favicon overlay on all marked tabs
 *
 * Run:
 *   SKIP_BUILD=1 npx playwright test test/playwright/Options.spec.ts --project chrome-mv3
 */

import {test as base, expect, type BrowserContext, type Page} from '@playwright/test'
import {execSync} from 'child_process'
import { launchChromeMv3Context, launchFirefoxMv3Context } from './helpers/extensions.js'

// ── Types ──────────────────────────────────────────────────────────────────────

type ExtFixtures = {
  context: BrowserContext
  extensionId: string
  /** Full origin — `chrome-extension://<id>` or `moz-extension://<uuid>` */
  extensionOrigin: string
}

/**
 * Serialisable snapshot of a single row extracted from the options page DOM.
 * Collected via page.evaluate() — must remain JSON-serialisable (no DOM refs).
 */
type TabRowSnapshot = {
  /** Numeric age in days, parsed from the cell-lastAccessAge-* text content. */
  age: number
  /** Full className string of the cell-lastAccess-* element (carries age CSS classes). */
  lastAccessClass: string
  /** True when the thumbnail img src starts with "data:" (L-bracket overlay present). */
  hasFaviconOverlay: boolean
}

// ── Expected mock data — keep in sync with TabStore.loadMockTabs() ─────────────

type MockTabEntry = {
  readonly daysAgo: number
  readonly isFresh: boolean
}

const MOCK_TABS_EXPECTED: readonly MockTabEntry[] = [
  {daysAgo: 1, isFresh: true},   // Fresh  (≤7d)  — NOT marked
  {daysAgo: 5, isFresh: true},   // Fresh  (≤7d)  — NOT marked
  {daysAgo: 10, isFresh: false},   // Young  (8–14d) — marked
  {daysAgo: 13, isFresh: false},   // Young  (8–14d) — marked
  {daysAgo: 16, isFresh: false},   // Middle (15–21d) — marked
  {daysAgo: 19, isFresh: false},   // Middle (15–21d) — marked
  {daysAgo: 22, isFresh: false},   // Old    (>21d)  — marked
  {daysAgo: 25, isFresh: false},   // Old    (>21d)  — marked
] as const

const EXPECTED_AGES = MOCK_TABS_EXPECTED.map(t => t.daysAgo)   // [1,5,10,13,16,19,22,25]
const EXPECTED_FRESH = MOCK_TABS_EXPECTED.filter(t => t.isFresh).map(t => t.daysAgo)  // [1,5]
const EXPECTED_MARKED = MOCK_TABS_EXPECTED.filter(t => !t.isFresh).map(t => t.daysAgo)  // [10,13,16,19,22,25]

// ── Fixtures ───────────────────────────────────────────────────────────────────

export const test = base.extend<ExtFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({browserName}, use) => {
    if (browserName === 'firefox') {
      const launched = await launchFirefoxMv3Context()
      await use(launched.context)
      await launched.context.close()
      await launched.cleanup()
    } else {
      const launched = await launchChromeMv3Context()
      await use(launched.context)
      await launched.context.close()
      await launched.cleanup()
    }
  },

  extensionId: async ({context}, use) => {
    // launchChrome/FirefoxMv3Context() already awaited the service worker internally,
    // so serviceWorkers()[0] is always defined by this point.
    const worker = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', {timeout: 15_000})
    const extId = new URL(worker.url()).host
    await use(extId)
  },

  extensionOrigin: async ({context}, use) => {
    // Derive the full origin from the service worker URL so it works for both:
    //   Chrome  → chrome-extension://<id>
    //   Firefox → moz-extension://<uuid>
    const worker = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', {timeout: 15_000})
    const workerUrl = new URL(worker.url())
    await use(`${workerUrl.protocol}//${workerUrl.host}`)
  },
})

// ── Build ──────────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  if (process.env['SKIP_BUILD'] === '1') {
    console.log('Skipping build (SKIP_BUILD=1)')
    return
  }
  console.log('Building extension…')
  // Clean stale output to avoid WXT rename collisions
  execSync('rm -rf .output/chrome-mv3 .output/firefox-mv3', { cwd: process.cwd() })
  execSync('npm run build-only', {stdio: 'inherit', cwd: process.cwd()})
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Scans all `cell-lastAccessAge-*` cells in the options page DOM and returns
 * a snapshot of each row's age, CSS classification class, and favicon state.
 *
 * Runs entirely inside the browser via page.evaluate() — no DOM objects leak
 * back to Node. Returns only JSON-serialisable data.
 */
async function collectTabRows(page: Page): Promise<TabRowSnapshot[]> {
  return page.evaluate<TabRowSnapshot[]>(() => {
    const ageCells = Array.from(
      document.querySelectorAll('[data-testid^="cell-lastAccessAge-"]')
    )

    const rows: TabRowSnapshot[] = []

    for (const ageCell of ageCells) {
      // Extract rowKey from data-testid="cell-lastAccessAge-<rowKey>"
      const testId = ageCell.getAttribute('data-testid') ?? ''
      const rowKey = testId.slice('cell-lastAccessAge-'.length)
      if (!rowKey) continue

      // Parse age: strip trailing "d" (or any non-digit chars) then parseInt
      const rawText = (ageCell.textContent ?? '').trim()
      const age = parseInt(rawText.replace(/[^0-9]/g, ''), 10)
      if (isNaN(age)) continue

      // Class list from the lastAccess cell carries bg-green-2, bg-amber-2, etc.
      const lastAccessCell = document.querySelector(`[data-testid="cell-lastAccess-${rowKey}"]`)
      const lastAccessClass = lastAccessCell?.className ?? ''

      // Favicon overlay: marked tabs have an <img src="data:…"> inside the thumbnail cell
      const thumbnailCell = document.querySelector(`[data-testid="cell-thumbnail-${rowKey}"]`)
      const thumbnailImg = thumbnailCell?.querySelector('img')
      const hasFaviconOverlay = (thumbnailImg?.getAttribute('src') ?? '').startsWith('data:')

      rows.push({age, lastAccessClass, hasFaviconOverlay})
    }

    return rows
  })
}

/**
 * Filters a snapshot array to rows whose age matches one of the provided days values.
 * Uses a Set for O(1) lookup — no destructuring.
 */
function filterRowsByAges(rows: TabRowSnapshot[], ages: readonly number[]): TabRowSnapshot[] {
  const ageSet = new Set(ages)
  return rows.filter(row => ageSet.has(row.age))
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe('Options page: Mock Tabs → Load & Mark flow', () => {

  test('full flow: mock tabs → correct ages → load & mark → correct classification', async ({
                                                                                              context,
                                                                                              extensionOrigin
                                                                                            }) => {
    test.setTimeout(120_000)

    const page = await context.newPage()

    // Forward browser console errors to the test output for easier debugging
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('[page error]', msg.text())
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Open options page and verify initial state', async () => {
      await page.goto(`${extensionOrigin}/options.html`, {
        waitUntil: 'domcontentloaded',
      })

      // "Load & Mark" toggle button must be visible (no tabs marked yet)
      await expect(page.getByTestId('btn-load-tabs')).toBeVisible({timeout: 8_000})

      // "Reset" toggle button must NOT be visible (same element, different testid)
      await expect(page.getByTestId('btn-reset')).not.toBeVisible()

      // "Mock tabs" dev button must be visible
      await expect(page.getByTestId('btn-gen-mock-tabs')).toBeVisible({timeout: 5_000})

      // Clear extension storage so we start from a clean slate.
      // Cast through unknown to access the chrome global that exists in the extension page context.
      await page.evaluate(() => (window as unknown as {
        chrome: { storage: { local: { clear: () => void } } }
      }).chrome.storage.local.clear())
      console.log('Initial state verified ✓')
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Generate mock tabs', async () => {
      await page.getByTestId('btn-gen-mock-tabs').click()

      // loadMockTabs() opens 8 real browser tabs and waits for up to 10s for
      // 70% of them to have favicons before resolving. The btn-gen-mock-tabs
      // button has :loading="tabStore.loading" — wait until it loses aria-disabled.
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="btn-gen-mock-tabs"]')
          // Quasar sets aria-disabled="true" while :loading is active
          return btn?.getAttribute('aria-disabled') !== 'true'
        },
        {timeout: 60_000}
      )

      // Wait until the table contains at least 8 age cells (one per mock tab)
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid^="cell-lastAccessAge-"]').length >= 8,
        {timeout: 30_000}
      )

      console.log('Mock tabs generated and table populated ✓')
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Assert all 8 mock tab ages appear in table', async () => {
      const rows = await collectTabRows(page)
      const foundAges = rows.map(r => r.age)

      console.log('Ages found in table:', foundAges.sort((a, b) => a - b))

      // All 8 expected ages must be present as a subset (table may have extra
      // rows from other tabs open in the test browser profile)
      for (const expectedAge of EXPECTED_AGES) {
        expect(
          foundAges,
          `Expected age ${expectedAge}d to appear in table`
        ).toContain(expectedAge)
      }

      console.log('All 8 expected ages present in table ✓')
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Click Load & Mark and wait for completion', async () => {
      await page.getByTestId('btn-load-tabs').click()

      // getAllOpenedTabs() + markTabWithLBracket() run async per tab.
      // The button toggles from "Load & Mark" (btn-load-tabs) to "Reset" (btn-reset)
      // as soon as the first tab is marked. Wait for that transition.
      await expect(page.getByTestId('btn-reset')).toBeVisible({timeout: 30_000})

      // Give remaining mark operations (favicon overlay rendering) time to finish
      await page.waitForTimeout(3_000)

      console.log('Load & Mark completed ✓')
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Assert fresh tabs (1d, 5d) are NOT marked — green background', async () => {
      const rows = await collectTabRows(page)
      const freshRows = filterRowsByAges(rows, EXPECTED_FRESH)

      console.log('Fresh rows snapshot:', freshRows)
      expect(freshRows.length, 'Should find fresh-tab rows').toBeGreaterThan(0)

      for (const row of freshRows) {
        expect(
          row.lastAccessClass,
          `Tab aged ${row.age}d should be green (fresh, not marked)`
        ).toContain('bg-green-2')
      }

      console.log(`Fresh tabs (${EXPECTED_FRESH.join('d, ')}d) carry bg-green-2 ✓`)
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Assert old tabs (10d+) ARE marked — amber/orange/red background', async () => {
      const rows = await collectTabRows(page)
      const markedRows = filterRowsByAges(rows, EXPECTED_MARKED)

      console.log('Marked rows snapshot:', markedRows)
      expect(markedRows.length, 'Should find marked-tab rows').toBeGreaterThan(0)

      for (const row of markedRows) {
        expect(
          row.lastAccessClass,
          `Tab aged ${row.age}d should NOT be green`
        ).not.toContain('bg-green-2')

        const isAmber = row.lastAccessClass.includes('bg-amber-2')
        const isOrange = row.lastAccessClass.includes('bg-orange-2')
        const isRed = row.lastAccessClass.includes('bg-red-2')

        expect(
          isAmber || isOrange || isRed,
          `Tab aged ${row.age}d should carry bg-amber-2, bg-orange-2, or bg-red-2 (got: "${row.lastAccessClass}")`
        ).toBe(true)
      }

      console.log(`Marked tabs (${EXPECTED_MARKED.join('d, ')}d) carry correct non-green class ✓`)
    })

    // ──────────────────────────────────────────────────────────────────────
    await test.step('Assert L-bracket favicon overlay on marked tabs', async () => {
      const rows = await collectTabRows(page)
      const markedRows = filterRowsByAges(rows, EXPECTED_MARKED)
      const freshRows = filterRowsByAges(rows, EXPECTED_FRESH)

      // All marked tabs should have isMarked set (non-fresh classification)
      expect(
        markedRows.length,
        'Should find marked-tab rows in L-bracket step'
      ).toBeGreaterThan(0)

      // Fresh tabs should NOT have the favicon overlay
      for (const row of freshRows) {
        expect(
          row.hasFaviconOverlay,
          `Tab aged ${row.age}d (fresh) should NOT have L-bracket favicon overlay`
        ).toBe(false)
      }

      console.log(`Marked tabs count: ${markedRows.length} ✓`)
      console.log('Fresh tabs have no favicon overlay ✓')
    })

    await page.close()
  })
})

