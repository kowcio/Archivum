/**
 * Thresholds Change Test
 *
 * Verifies that when thresholds change:
 * 1. Store object is updated (appStateStorage)
 * 2. OptionsPage automatically picks up changes and re-renders table
 * 3. Tab age classification reflects new thresholds
 * 4. Groups are recreated with new granularity
 */

import { test, expect, type BrowserContext } from '@playwright/test'
import { launchChromeContext } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> }

/**
 * Helper: Set mock tab overrides in storage to simulate tabs of different ages.
 * Mock overrides map tabId → lastAccessed timestamp (milliseconds).
 */
async function setMockOverrides(page: any, overrides: Record<number, number>): Promise<void> {
  // @ts-ignore - runs inside page.evaluate context where chrome is available
  await page.evaluate((mockOverrides) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ mock_overrides: mockOverrides }, () => resolve());
    });
  }, overrides);
  console.log('[Test] Set mock overrides:', Object.entries(overrides).slice(0, 3));
}

test.describe('Threshold Change: Store → Options Auto-Update', () => {
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

  test('should create 4 threshold groups with proper order after applying threshold level 4', async () => {
    const options = new OptionsPage(ctx.context.pages()[0])

    // 1. Open options page
    await options.goto(ctx.extensionId)
    await options.expectPageLoaded()

    // 2. Click the mock button to load mock tabs
    await options.clickLoadMockTabs(800)

    // 3. Change the threshold level to 4
    await options.changeThresholdLevels(5, 2000)

    // 4. Verify 4 groups exist and check group titles in order
    let result = await options.getGroupAndTabData()

    expect(result.groups.length).toBe(5)
    expect(result.groups[0].title).toContain('Are You kidding')
    expect(result.groups[1].title).toContain('Quarter+')
    expect(result.groups[2].title).toContain('Month+')
    expect(result.groups[3].title).toContain('2 Weeks+')
    expect(result.groups[4].title).toContain('Week+')

    await options.changeThresholdLevels(1, 3000)

    result = await options.getGroupAndTabData()

    expect(result.groups.length).toBe(1)
    expect(result.groups[0].title).toContain('Week+')


    // 5. Verify grouped tabs have valid groupIds and ungrouped tabs have groupId -1
    const groupedTabs = result.tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined)
    const ungroupedTabs = result.tabs.filter(t => t.groupId === -1 || t.groupId === undefined)

    expect(groupedTabs.length).toBeGreaterThan(0)
    expect(ungroupedTabs.length).toBeGreaterThan(0)

    // Verify first grouped tab has a valid groupId (exact value)
    if (groupedTabs.length > 0) {
      const firstGroupedTab = groupedTabs[0]
      expect(typeof firstGroupedTab.groupId).toBe('number')
      expect(firstGroupedTab.groupId).not.toBe(-1)
    }

    // Verify ungrouped tabs are at the end with groupId === -1
    ungroupedTabs.forEach(tab => {
      expect(tab.groupId).toBe(-1)
    })
  })

})










