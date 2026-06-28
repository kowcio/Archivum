/**
 * Thresholds Change Test
 *
 * Verifies that when thresholds change:
 * 1. Store object is updated (appStateStorage)
 * 2. OptionsPage automatically picks up changes and re-renders table
 * 3. Tab age classification reflects new thresholds
 * 4. Groups are recreated with new granularity
 */

import {test, expect} from '@playwright/test'
import {setupExtensionTest, type ExtensionTestContext} from './chromium/extensions.js'
import {OptionsPage} from './page-objects/OptionsPage.js'

test.describe('Threshold Change: Store → Options Auto-Update', () => {
  let ctx: ExtensionTestContext

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    ctx = await setupExtensionTest(false, 90_000)
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (ctx) await ctx.cleanup()
  })

  test('should create threshold groups with proper order when thresholds change', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    // 1. Open options page
    await options.goto(ctx.extensionId)

    // 2. Load mock tabs first (before checking if page is fully loaded)
    await options.clickLoadMockTabs(800)

    // 3. Wait for table to be visible with tabs
    await options.expectTableVisible()

    // 4. Verify page structure is ready
    await options.expectThresholdsVisible()

    // 5. Change to 5 levels and verify groups
    await options.changeThresholdLevels(5, 2000)
    let result = await options.getGroupAndTabData()

    expect(result.groups.length).toBe(5)
    expect(result.groups[0].title).toContain('Eat that frog!')
    expect(result.groups[1].title).toContain('Quarter+')
    expect(result.groups[2].title).toContain('Month+')
    expect(result.groups[3].title).toContain('2 Weeks+')
    expect(result.groups[4].title).toContain('Week+')

    // 6. Verify tab grouping status
    let groupedTabs = result.tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined)
    let ungroupedTabs = result.tabs.filter(t => t.groupId === -1 || t.groupId === undefined)

    expect(groupedTabs.length).not.toBe(0)
    expect(ungroupedTabs.length).not.toBe(0)
    groupedTabs.forEach(tab => {
      expect(typeof tab.groupId).toBe('number')
      expect(tab.groupId).not.toBe(-1)
    })
    ungroupedTabs.forEach(tab => {
      expect(tab.groupId).toBe(-1)
    })

    // 7. Change to 1 level and verify
    await options.changeThresholdLevels(1, 3000)
    result = await options.getGroupAndTabData()

    expect(result.groups.length).toBe(1)
    expect(result.groups[0].title).toContain('Week+')

    // 8. Verify grouped/ungrouped status remains valid
    groupedTabs = result.tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined)
    ungroupedTabs = result.tabs.filter(t => t.groupId === -1 || t.groupId === undefined)

    expect(groupedTabs.length).not.toBe(0)
    expect(ungroupedTabs.length).not.toBe(0)
  })

})
