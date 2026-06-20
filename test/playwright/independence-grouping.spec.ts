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

      // Click mock button
      const mockResult = await options.clickLoadMockTabs()
      expect(mockResult.ok).toBe(true)

       // Group tabs
       await options.clickGroupTabs(2000)

       // Get all tabs and groups
       const result = await options.getGroupAndTabData()

      // Verify: 3 groups created (one per active threshold level)
      expect(result.groupCount).toBe(3)
      expect(result.groups.length).toBe(3)

      // Verify: Each group has id and title
      expect(result.groups[0].title).toContain("Month+")
      expect(result.groups[1].title).toContain("2 Weeks+")
      expect(result.groups[2].title).toContain("Week+")
      expect(result.ungroupedTabCount).toBe(2) // 2 fresh tabs should remain ungrouped

      // Verify: Both grouped and ungrouped tabs exist
      expect(result.groupedTabCount).toBeDefined()
      expect(result.ungroupedTabCount).toBeDefined()

      console.log(`✅ PASSED: ${result.groupCount} groups, ${result.groupedTabCount} grouped, ${result.ungroupedTabCount} ungrouped`)

    } finally {
      await options.close()
    }
  })
})
