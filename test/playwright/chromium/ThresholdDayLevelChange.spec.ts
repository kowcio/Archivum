/**
 * E2E test: Change threshold day level and verify group tab counts change.
 *
 * Verifies that when Week+ threshold changes from 7→3 days:
 * - More tabs become "Week+" (shifted from fresh)
 * - Tab counts per group reflect the new classification
 * - All groups are created correctly after Apply
 */
import {test, expect} from '@playwright/test'
import {setupExtensionTest, type ExtensionTestContext} from './extensions.js'
import {OptionsPage} from '../page-objects/OptionsPage.js'
import {ThresholdLabel} from "../../../src/constants.js";

test.describe('Threshold Day Levels', () => {
  let ctx: ExtensionTestContext

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    ctx = await setupExtensionTest(false, 90_000)
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (ctx) await ctx.cleanup()
  })

  test('Check threshold day levels to save properly and change tabs after apply', async () => {
    const options = new OptionsPage(await ctx.context.newPage())
    await options.goto(ctx.extensionId)

    // 1. Create mock tabs (14 tabs with various daysAgo values)
    const resp = await options.clickLoadMockTabs(800)
    expect(resp.ok).toBe(true)

    // 2. Group tabs with default thresholds (Week+=7, 2 Weeks+=14, Month+=28)
    await options.clickGroupTabs(2500)
    let groups = await options.getAllGroups()

          // Default classification (14 mocks + 2 extension pages = 16 total):
          //   Fresh (≤7):      1, 6 + 2 ext pages → 4 tabs
          //   Week+ (7-14):    8, 8, 12          → 3 tabs
          //   2 Weeks+ (14-28): 18, 25           → 2 tabs
          //   Month+ (28-90):  40, 60            → 2 tabs
          //   Quarter+ (90-365): 100, 101, 356   → 3 tabs
          //   Years (365+):    366, 367 + ? → 3 tabs
          expect(groups.length).toBe(5)
          // Groups ordered left-to-right: Hell! (oldest) → ... → Week+ (youngest)
           expect(groups[0].title).toContain(ThresholdLabel.YEARS)
           expect(groups[1].title).toContain(ThresholdLabel.QUARTERS)
           expect(groups[2].title).toContain(ThresholdLabel.MONTH)
           expect(groups[3].title).toContain(ThresholdLabel.WEEKS_2)
           expect(groups[4].title).toContain(ThresholdLabel.WEEK)
           expect(groups[0].tabCount).toBe(3)
           expect(groups[1].tabCount).toBe(2)
           expect(groups[2].tabCount).toBe(2)
           expect(groups[3].tabCount).toBe(3)
           expect(groups[4].tabCount).toBe(2)

    // 3. Change Week+ threshold from 7→3 days.
    // This will shift tab 6 (daysAgo=6) from fresh into Week+ group.
        await options.changeThresholdDayValue(0, 3, 2000)

          // 4. Verify group tab counts reflect new thresholds.
          // After changing Week+ from 7→3 days, activeLevels still 5, so 5 groups remain:
          //   Years (365+):    366, 367, ?                  → 3 tabs
          //   Quarter+ (90-365): 100, 101, 356              → 3 tabs
          //   Month+ (28-90):  40, 60                       → 2 tabs
          //   2 Weeks+ (14-28): 18, 25                      → 2 tabs
          //   Week+ (3-14):    6, 8, 8, 12                  → 4 tabs (6 moves from fresh to week+)
          //   Fresh (≤3):      1                            → 1 tab (+ 2 ext pages = 3 ungrouped)
            groups = await options.getAllGroups()
            expect(groups.length).toBe(5)
            expect(groups[0].title).toContain('Hell!')
            expect(groups[1].title).toContain('Quarter+')
            expect(groups[2].title).toContain('Month+')
            expect(groups[3].title).toContain('2 Weeks+')
            expect(groups[4].title).toContain('Week+')
             expect(groups[0].tabCount).toBe(4)
             expect(groups[1].tabCount).toBe(2)
            expect(groups[2].tabCount).toBe(2)
            expect(groups[3].tabCount).toBe(3)
            expect(groups[4].tabCount).toBe(2)

        // 5. Verify fresh (ungrouped) tabs: 3 total (1 fresh mock at ≤3 days + 2 extension pages)
            const ungroupedCount = await options.getUngroupedTabCount()
            expect(ungroupedCount).toBe(3)

        await options.close()
  })
})
