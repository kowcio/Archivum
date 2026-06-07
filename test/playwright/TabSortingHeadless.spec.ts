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
import fs from 'fs'
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
    // Clean stale output to avoid WXT rename collisions (cross-platform)
    const outputDirs = ['.output/chrome-mv3', '.output/firefox-mv3']
    for (const dir of outputDirs) {
      const fullPath = path.join(process.cwd(), dir)
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true })
      }
    }
    execSync('npm run build-only', { stdio: 'inherit', cwd: process.cwd() })
})

test.describe('Tab Sorting and Grouping (Headless)', () => {

    test('options page loads with group-by-age button visible (ungrouped initial state)', async ({ context, extensionId }) => {
        test.setTimeout(30_000)
        const page = await context.newPage()
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })

        await expect(page.getByTestId('btn-group-by-age')).toBeVisible({ timeout: 8_000 })
        await expect(page.getByTestId('btn-ungroup-tabs')).not.toBeVisible()
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

    test('tabs table renders after generating mock tabs with rows sorted by ordinal', async ({ context, extensionId }) => {
        test.setTimeout(60_000)
        const page = await context.newPage()

        page.on('console', msg => {
            if (msg.type() === 'error') console.error('[page]', msg.text())
        })

        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('btn-gen-mock-tabs')).toBeVisible({ timeout: 8_000 })

        // Generate mock tabs to populate the table
        await page.getByTestId('btn-gen-mock-tabs').click()

        // Wait for loading to complete
        await page.waitForFunction(
            () => document.querySelector('[data-testid="btn-gen-mock-tabs"]')?.getAttribute('aria-disabled') !== 'true',
            { timeout: 60_000 }
        )

        // Wait for table to appear with at least one row
        const table = page.getByTestId('current-tabs-table')
        await expect(table).toBeVisible({ timeout: 15_000 })

        // Verify ordinal cells are sorted ascending
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
            for (let i = 1; i < ordinals.length; i++) {
                expect(ordinals[i]).toBeGreaterThan(ordinals[i - 1])
            }
            console.log('Tabs sorted by ordinal ascending ✓')
        }
    })

    test('group/ungroup flow works after generating mock tabs', async ({ context, extensionId }) => {
        test.setTimeout(90_000)
        const page = await context.newPage()

        page.on('console', msg => {
            if (msg.type() === 'error') console.error('[page]', msg.text())
        })

        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('btn-group-by-age')).toBeVisible({ timeout: 10_000 })

        // Generate mock tabs (provides tabs with real age data for grouping)
        await expect(page.getByTestId('btn-gen-mock-tabs')).toBeVisible({ timeout: 5_000 })
        await page.getByTestId('btn-gen-mock-tabs').click()

        await page.waitForFunction(
            () => document.querySelector('[data-testid="btn-gen-mock-tabs"]')?.getAttribute('aria-disabled') !== 'true',
            { timeout: 60_000 }
        )

        await page.waitForFunction(
            () => document.querySelectorAll('[data-testid^="cell-lastAccessAge-"]').length >= 3,
            { timeout: 30_000 }
        )

        // Group by age → button should change to Ungroup
        await page.getByTestId('btn-group-by-age').click()
        await expect(page.getByTestId('btn-ungroup-tabs')).toBeVisible({ timeout: 20_000 })
        console.log('Group by age completed ✓')

        // Ungroup → button should change back to Group by age
        await page.getByTestId('btn-ungroup-tabs').click()
        await expect(page.getByTestId('btn-group-by-age')).toBeVisible({ timeout: 10_000 })
        console.log('Ungroup completed ✓')
    })
})
