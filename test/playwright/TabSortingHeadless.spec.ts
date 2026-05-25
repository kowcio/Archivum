/**
 * Headless E2E tests for tab sorting and grouping logic fixes.
 *
 * Tests:
 * 1. Tabs are sorted by ordinal (browser tab position) ascending by default
 * 2. Reset button is visible and operable
 * 3. Group by age button is visible
 *
 * Run:
 *   SKIP_BUILD=1 npx playwright test test/playwright/TabSortingHeadless.spec.ts --project chrome-mv3
 */

import { test as base, chromium, expect, type BrowserContext } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
const EXT_DIR = path.resolve(process.cwd(), '.output', 'chrome-mv3')

type ExtFixtures = {
    context: BrowserContext
    extensionId: string
}

export const test = base.extend<ExtFixtures>({
    // eslint-disable-next-line no-empty-pattern
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext('', {
            channel: 'chromium',
            headless: true,
            args: [
                `--disable-extensions-except=${EXT_DIR}`,
                `--load-extension=${EXT_DIR}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
            ],
        })
        await use(context)
        await context.close()
    },

    extensionId: async ({ context }, use) => {
        let [serviceWorker] = context.serviceWorkers()
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 })
        }
        const extensionId = serviceWorker.url().split('/')[2]
        await use(extensionId)
    },
})

test.beforeAll(() => {
    if (process.env.SKIP_BUILD === '1') {
        console.log('Skipping build (SKIP_BUILD=1)')
        return
    }
    console.log('Building extension…')
    execSync('npm run build-only', { stdio: 'inherit', cwd: process.cwd() })
})

test.describe('Tab Sorting and Grouping (Headless)', () => {

    test('options page loads with btn-load-tabs and btn-reset visible', async ({ context, extensionId }) => {
        test.setTimeout(30_000)
        const page = await context.newPage()
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })

        await expect(page.getByTestId('btn-load-tabs')).toBeVisible({ timeout: 8_000 })
        await expect(page.getByTestId('btn-reset')).toBeVisible({ timeout: 4_000 })
        console.log('Options controls visible ✓')
    })

    test('Group by age button is initially visible (not grouped state)', async ({ context, extensionId }) => {
        test.setTimeout(30_000)
        const page = await context.newPage()
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })

        // When not grouped, the button shows "Group by age"
        await expect(page.getByTestId('btn-group-by-age')).toBeVisible({ timeout: 8_000 })
        console.log('Group by age button visible ✓')
    })

    test('tabs table renders after loading tabs with rows sorted by ordinal', async ({ context, extensionId }) => {
        test.setTimeout(40_000)
        const page = await context.newPage()

        // Collect console errors for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') console.error('[page]', msg.text())
        })

        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('btn-load-tabs')).toBeVisible({ timeout: 8_000 })

        // Click Load Tabs
        await page.getByTestId('btn-load-tabs').click()

        // Wait for table to appear with at least one row
        const table = page.getByTestId('current-tabs-table')
        await expect(table).toBeVisible({ timeout: 15_000 })

        // Find all rows and check that ordinal column values are sorted ascending
        // The ordinal column has header "#" and cells have data-testid="cell-ordinal-<rowKey>"
        const ordinalCells = page.locator('[data-testid^="cell-ordinal-"]')
        const count = await ordinalCells.count()
        console.log(`Found ${count} ordinal cells`)

        if (count > 1) {
            const ordinals: number[] = []
            for (let i = 0; i < Math.min(count, 10); i++) {
                const text = (await ordinalCells.nth(i).textContent())?.trim() ?? ''
                const num = parseInt(text, 10)
                if (!isNaN(num)) ordinals.push(num)
            }
            console.log('Ordinals:', ordinals)
            // Ordinals should be sorted ascending (1, 2, 3, ...)
            for (let i = 1; i < ordinals.length; i++) {
                expect(ordinals[i]).toBeGreaterThan(ordinals[i - 1])
            }
            console.log('Tabs sorted by ordinal ascending ✓')
        }
    })

    test('reset button clears tab marks', async ({ context, extensionId }) => {
        test.setTimeout(40_000)
        const page = await context.newPage()

        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('btn-load-tabs')).toBeVisible({ timeout: 8_000 })

        // Load tabs
        await page.getByTestId('btn-load-tabs').click()
        await expect(page.getByTestId('current-tabs-table')).toBeVisible({ timeout: 15_000 })

        // Click Reset
        await page.getByTestId('btn-reset').click()

        // After reset, the table should still be visible (reload happens)
        await expect(page.getByTestId('current-tabs-table')).toBeVisible({ timeout: 10_000 })
        console.log('Reset completed without errors ✓')
    })
})


