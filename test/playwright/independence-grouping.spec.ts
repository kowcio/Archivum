/**
 * groupTabsByAge E2E Test
 *
 * Verifies:
 * 1. Options page loads
 * 2. Mock tabs can be created
 * 3. Tabs are grouped by age (3 groups)
 * 4. Fresh tabs remain ungrouped
 */

import { test, expect, type BrowserContext } from '@playwright/test'
import { launchChromeContext } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> }

test.describe('groupTabsByAge E2E', () => {
  test.setTimeout(60_000)
  let ctx: Ctx

  test.beforeAll('Setup', async () => {
    test.skip(test.info().project.name !== 'chrome-mv3', 'Chrome MV3 only')
    ctx = await launchChromeContext()
    OptionsPage.setupServiceWorkerLogging(ctx.context)
  })

  test.afterAll('Cleanup', async () => {
    if (ctx) await ctx.cleanup()
  })

  test('Load options, click mock, group tabs, verify groups and ungrouped tabs', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      // Load options page
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()

      // Close any existing tabs first (to have clean slate with only 1 tab = options page)
      await options.clickCloseAllTabs()
      await options.page.waitForTimeout(500)

      // Click mock button
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

      // Extra wait to ensure mock overrides are persisted to storage (WXT sync)
      await options.page.waitForTimeout(1000)

       // Group tabs
       await options.clickGroupTabs(2000)

       // Get all tabs and groups
       const result = await options.getGroupAndTabData()

      // Verify: 3 groups created (one per active threshold level)
      expect(result.groupCount).toBe(3)
      expect(result.groups.length).toBe(3)

      // Verify: Each group has id and title (oldest → youngest, left → right)
      expect(result.groups[0].title).toContain("Month+")
      expect(result.groups[1].title).toContain("2 Weeks+")
      expect(result.groups[2].title).toContain("Week+")

      //check ungrouped tabs
      expect(result.tabs[12].title).toContain("chrome-extension")
      expect(result.tabs[13].title).toContain("domeczek")
      expect(result.tabs[14].title).toContain("leroymerlin") // youngest tab (fresh)

      //check the oldest tab from all should be first in tab[0]
      expect(result.tabs[0].url).toContain("www.npmjs.com")
      expect(result.tabs[0].groupId).toBeDefined()

      // Verify: Ungrouped tabs exist (should have at least 2 fresh tabs + options page)
      const ungroupedTabs = result.tabs.filter(t => !t.groupId || t.groupId === -1)
      expect(ungroupedTabs.length).toBeGreaterThanOrEqual(2)

      console.log(`✅ PASSED: ${result.groupCount} groups (oldest→youngest left→right), ${ungroupedTabs.length} ungrouped tabs`)

    } finally {
      // Pages are auto-closed by Playwright
    }
  })
})
