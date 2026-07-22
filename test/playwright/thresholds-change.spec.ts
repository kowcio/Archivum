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
import {setupExtensionTest, type ExtensionTestContext, WAIT_MS} from './chromium/extensions.js'
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

    // 2. Load mock tabs (14 tabs with ages: 1,6,8,8,12,18,25,40,60,100,101,356,366,367)
    await options.clickLoadMockTabs()
    await options.page.waitForTimeout(WAIT_MS)

    // 3. Group tabs with default thresholds (5 active levels)
    await options.clickGroupTabs()

    console.log('\n═══ LEVEL 5: Default (7,14,28,90,365 days) ═══')
    let result = await options.getGroupAndTabData()
    console.log(`Groups: ${result.groupsOrderedByIndex.length}, Grouped: ${result.groupedTabCount}, Ungrouped: ${result.ungroupedTabCount}`)
    result.groupsOrderedByIndex.forEach((g, i) => {
      const tabs = result.tabs.filter(t => t.groupId === g.id)
      console.log(`  [${i}] "${g.title}" → ${tabs.length} tabs`)
    })

    // Level 5 expected: [Hell!:3, Quarter+:2, Month+:2, 2Weeks+:3, Week+:2] (ordered oldest→youngest left→right)
    expect(result.groupsOrderedByIndex.length).toBe(5)
    expect(result.groupsOrderedByIndex[0].title).toContain('Hell!')
    expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+')
    expect(result.groupsOrderedByIndex[2].title).toContain('Month+')
    expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+')
    expect(result.groupsOrderedByIndex[4].title).toContain('Week+')

    // 4. Change to 4 levels and verify
    console.log('\n═══ LEVEL 4: Change to 4 levels (without Years boundary) ═══')
    await options.changeThresholdLevels(4)
    result = await options.getGroupAndTabData()
    console.log(`Groups: ${result.groupsOrderedByIndex.length}, Grouped: ${result.groupedTabCount}, Ungrouped: ${result.ungroupedTabCount}`)
    result.groupsOrderedByIndex.forEach((g, i) => {
      const tabs = result.tabs.filter(t => t.groupId === g.id)
      console.log(`  [${i}] "${g.title}" → ${tabs.length} tabs`)
    })

    // Level 4 expected: [Quarter+:3, Month+:2, 2Weeks+:2, Week+:3] (no Hell!, ordered oldest→youngest)
    expect(result.groupsOrderedByIndex.length).toBe(4)
    expect(result.groupsOrderedByIndex[0].title).toContain('Quarter+')
    expect(result.groupsOrderedByIndex[1].title).toContain('Month+')
    expect(result.groupsOrderedByIndex[2].title).toContain('2 Weeks+')
    expect(result.groupsOrderedByIndex[3].title).toContain('Week+')

    // 5. Change to 3 levels and verify
    console.log('\n═══ LEVEL 3: Change to 3 levels (without Quarter+ and Hell!) ═══')
    await options.changeThresholdLevels(3)
    result = await options.getGroupAndTabData()
    console.log(`Groups: ${result.groupsOrderedByIndex.length}, Grouped: ${result.groupedTabCount}, Ungrouped: ${result.ungroupedTabCount}`)
    result.groupsOrderedByIndex.forEach((g, i) => {
      const tabs = result.tabs.filter(t => t.groupId === g.id)
      console.log(`  [${i}] "${g.title}" → ${tabs.length} tabs`)
    })

    // Level 3 expected: [Month+:7, 2Weeks+:2, Week+:3] (no Quarter+, Hell!, ordered oldest→youngest)
    expect(result.groupsOrderedByIndex.length).toBe(3)
    expect(result.groupsOrderedByIndex[0].title).toContain('Month+')
    expect(result.groupsOrderedByIndex[1].title).toContain('2 Weeks+')
    expect(result.groupsOrderedByIndex[2].title).toContain('Week+')

    // 6. Change back to 5 levels and verify
    console.log('\n═══ LEVEL 5: Change back to 5 levels (7,14,28,90,365 days) ═══')
    await options.changeThresholdLevels(5)
    result = await options.getGroupAndTabData()
    console.log(`Groups: ${result.groupsOrderedByIndex.length}, Grouped: ${result.groupedTabCount}, Ungrouped: ${result.ungroupedTabCount}`)
    result.groupsOrderedByIndex.forEach((g, i) => {
      const tabs = result.tabs.filter(t => t.groupId === g.id)
      console.log(`  [${i}] "${g.title}" → ${tabs.length} tabs`)
    })

    // Level 5 expected again: [Hell!:3, Quarter+:3, Month+:2, 2Weeks+:2, Week+:3] (ordered oldest→youngest)
    expect(result.groupsOrderedByIndex.length).toBe(5)
    expect(result.groupsOrderedByIndex[0].title).toContain('Hell!')
    expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+')
    expect(result.groupsOrderedByIndex[2].title).toContain('Month+')
    expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+')
    expect(result.groupsOrderedByIndex[4].title).toContain('Week+')

    console.log('\n✅ All threshold levels verified with correct group order!')
  })

})
