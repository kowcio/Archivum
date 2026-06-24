/**
 * E2E test: Change threshold day level and verify group tab counts change.
 * 
 * Verifies that when Week+ threshold changes from 7→13 days:
 * - More tabs become "Fresh" (ungrouped)
 * - Tab counts per group reflect the new classification
 * - All groups are created correctly after Apply
 */
import {test, expect, type BrowserContext} from '@playwright/test'
import {launchChromeContext} from './extensions.js'
import {OptionsPage} from '../page-objects/OptionsPage.js'

type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> }

test.describe('Threshold Day Levels', () => {
  test.setTimeout(90_000)
  let ctx: Ctx

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    test.skip(test.info().project.name !== 'chrome-mv3', 'Chrome MV3 only')
    ctx = await launchChromeContext()
    OptionsPage.setupServiceWorkerLogging(ctx.context)
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (ctx) await ctx.cleanup()
  })

  test('Check threshold day levels to save properly and change tabs after apply', async () => {
    const options = new OptionsPage(await ctx.context.newPage())
    await options.goto(ctx.extensionId)
    await options.expectPageLoaded()

    // 1. Create mock tabs (14 tabs with various daysAgo values)
    const resp = await options.clickLoadMockTabs(800)
    expect(resp.ok).toBe(true)

    // 2. Group tabs with default thresholds (Week+=7, 2 Weeks+=14, Month+=28)
    await options.clickGroupTabs(1500)
    let groups = await options.getAllGroups()

    // Default classification:
        //   Fresh (≤7):      1, 6              → 2 tabs
        //   Week+ (7-14):    8, 8, 12          → 3 tabs
        //   2 Weeks+ (14-28): 18, 25           → 2 tabs
        //   Month+ (>28):    40, 60, 100, 101, 356, 366, 367  → 7 tabs
        expect(groups.length).toBe(3)
        // Groups ordered left-to-right: Month+ (oldest) → 2 Weeks+ → Week+ (youngest)
        expect(groups[0].title).toContain('Month+')
        expect(groups[1].title).toContain('2 Weeks+')
        expect(groups[2].title).toContain('Week+')
        expect(groups[0].tabCount).toBe(7)
        expect(groups[1].tabCount).toBe(2)
        expect(groups[2].tabCount).toBe(3)

    // 3. Change Week+ threshold from 7→13 days.
        // First ungroup all so stale groups don't interfere with new classification.
        await options.clickUngroupTabs(1000)
        await options.changeThresholdDayValue(0, 13, 2000)

        // 4. Verify group tab counts reflect new thresholds.
        groups = await options.getAllGroups()
        expect(groups.length).toBe(2)
        expect(groups[0].title).toContain('Month+')
        expect(groups[1].title).toContain('2 Weeks+')
        expect(groups[0].tabCount).toBe(7)
        expect(groups[1].tabCount).toBe(2)

        // 5. Verify more fresh (ungrouped) tabs: 7 total (5 fresh mocks + 2 extension pages)
            const ungroupedCount = await options.getUngroupedTabCount()
            expect(ungroupedCount).toBe(7)

        await options.close()
  })
})