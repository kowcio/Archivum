/**
 * E2E Playwright test — Options page: Mock Tabs → Group by age flow.
 *
 * Steps:
 *   1. Open options page, verify initial state (btn-group-by-age + btn-gen-mock-tabs visible)
 *   2. Click "Mock tabs" → 8 real browser tabs created with historical ages
 *   3. Assert table shows all 8 expected ages (1, 5, 10, 13, 16, 19, 22, 25 days)
 *   4. Assert age cells display correct day counts
 *   5. Click "Group by age" → isGrouped=true → btn-ungroup-tabs appears
 *   6. Ungroup → btn-group-by-age reappears
 *
 * Run:
 *   SKIP_BUILD=1 npx playwright test test/playwright/Options.spec.ts --project chrome-mv3
 */

import {test as base, expect, type BrowserContext, type Page} from '@playwright/test'
import {execSync} from 'child_process'
import fs from 'fs'
import path from 'path'
import { launchChromeMv3Context } from './helpers/extensions.js'

// ── Types ──────────────────────────────────────────────────────────────────────

type ExtFixtures = {
  context: BrowserContext
  extensionId: string
  extensionOrigin: string
}

type TabRowSnapshot = {
  age: number
  rowKey: string
}

// ── Expected mock data — keep in sync with appStore.loadMockTabs() ─────────────

const MOCK_TABS_EXPECTED_AGES = [1, 5, 10, 13, 16, 19, 22, 25] as const

// ── Fixtures ───────────────────────────────────────────────────────────────────

export const test = base.extend<ExtFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({browserName}, use) => {
    if (browserName === 'firefox') {
      use({} as BrowserContext)
      return
    }
    const launched = await launchChromeMv3Context()
    await use(launched.context)
    await launched.context.close()
    await launched.cleanup()
  },

  extensionId: async ({context}, use) => {
    if (!context || !context.serviceWorkers) { await use(''); return }
    const worker = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', {timeout: 15_000})
    await use(new URL(worker.url()).host)
  },

  extensionOrigin: async ({context}, use) => {
    if (!context || !context.serviceWorkers) { await use(''); return }
    const worker = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', {timeout: 15_000})
    const u = new URL(worker.url())
    await use(`${u.protocol}//${u.host}`)
  },
})

// ── Build ──────────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  if (process.env['SKIP_BUILD'] === '1') {
    console.log('Skipping build (SKIP_BUILD=1)')
    return
  }
  console.log('Building extension…')
  const outputDirs = ['.output/chrome-mv3', '.output/firefox-mv3']
  for (const dir of outputDirs) {
    const fullPath = path.join(process.cwd(), dir)
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }
  }
  execSync('npm run build-only', {stdio: 'inherit', cwd: process.cwd()})
})

// ── Helpers ────────────────────────────────────────────────────────────────────

async function collectTabRows(page: Page): Promise<TabRowSnapshot[]> {
  return page.evaluate<TabRowSnapshot[]>(() => {
    const ageCells = Array.from(document.querySelectorAll('[data-testid^="cell-lastAccessAge-"]'))
    return ageCells.flatMap(cell => {
      const testId = cell.getAttribute('data-testid') ?? ''
      const rowKey = testId.slice('cell-lastAccessAge-'.length)
      if (!rowKey) return []
      const age = parseInt((cell.textContent ?? '').trim().replace(/[^0-9]/g, ''), 10)
      if (isNaN(age)) return []
      return [{ age, rowKey }]
    })
  })
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe('Options page: Mock Tabs → Group by age flow', () => {

  test('full flow: mock tabs → correct ages → group → ungroup', async ({
    context,
    extensionOrigin,
  }) => {
    test.skip(!context || !extensionOrigin, 'Chrome only')
    test.setTimeout(120_000)

    const page = await context.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('[page error]', msg.text())
    })

    // ── Step 1: Initial state ──────────────────────────────────────────────
    await test.step('Open options page and verify initial state', async () => {
      await page.goto(`${extensionOrigin}/options.html`, { waitUntil: 'domcontentloaded' })

      await expect(page.getByTestId('btn-group-by-age')).toBeVisible({ timeout: 8_000 })
      await expect(page.getByTestId('btn-ungroup-tabs')).not.toBeVisible()
      await expect(page.getByTestId('btn-gen-mock-tabs')).toBeVisible({ timeout: 5_000 })

      await page.evaluate(() => (window as any).chrome?.storage?.local?.clear?.())
      console.log('Initial state verified ✓')
    })

    // ── Step 2: Generate mock tabs ─────────────────────────────────────────
    await test.step('Generate mock tabs', async () => {
      await page.getByTestId('btn-gen-mock-tabs').click()

      await page.waitForFunction(
        () => document.querySelector('[data-testid="btn-gen-mock-tabs"]')?.getAttribute('aria-disabled') !== 'true',
        { timeout: 60_000 }
      )
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid^="cell-lastAccessAge-"]').length >= 8,
        { timeout: 30_000 }
      )
      console.log('Mock tabs generated ✓')
    })

    // ── Step 3: Verify ages in table ───────────────────────────────────────
    await test.step('Assert all 8 expected ages appear in table', async () => {
      const rows = await collectTabRows(page)
      const foundAges = rows.map(r => r.age)
      console.log('Ages found in table:', foundAges.sort((a, b) => a - b))

      for (const expectedAge of MOCK_TABS_EXPECTED_AGES) {
        expect(foundAges, `Age ${expectedAge}d should appear in table`).toContain(expectedAge)
      }
      console.log('All 8 expected ages present ✓')
    })

    // ── Step 4: Group by age ───────────────────────────────────────────────
    await test.step('Click Group by age → button switches to Ungroup', async () => {
      await page.getByTestId('btn-group-by-age').click()

      await expect(page.getByTestId('btn-ungroup-tabs')).toBeVisible({ timeout: 15_000 })
      console.log('Tabs grouped ✓ (btn-ungroup-tabs visible)')
    })

    // ── Step 5: Ungroup ────────────────────────────────────────────────────
    await test.step('Click Ungroup → button switches back to Group by age', async () => {
      await page.getByTestId('btn-ungroup-tabs').click()

      await expect(page.getByTestId('btn-group-by-age')).toBeVisible({ timeout: 10_000 })
      console.log('Tabs ungrouped ✓ (btn-group-by-age visible)')
    })

    await page.close()
  })
})


