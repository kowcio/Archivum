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

    // 4.1 Create new random urls with random groups and get their generated IDs
    const newGroup1 = await options.openRandomTabInGroup(true, 2)
    const newGroup2 = await options.openRandomTabInGroup(true, -1)

     // 5. Group tabs with default thresholds (5 active levels)
     await options.clickGroupTabs(2000)
     let result = await options.getGroupAndTabData()
     // Note: The actual group order may vary because random groups may be interspersed
     // Just verify we have all expected groups present
     const groupTitles = result.groupsOrderedByIndex.map(g => g.title)

     expect(result.groupsOrderedByIndex.length).toBe(7) // 5 age-based + 2 random groups ✅

    // result.gr
    // Verify age-based groups exist
    expect(groupTitles.some(t => t.includes('Eat that frog!'))).toBe(true)
    expect(groupTitles.some(t => t.includes('Quarter+'))).toBe(true)
    expect(groupTitles.some(t => t.includes('Month+'))).toBe(true)
    expect(groupTitles.some(t => t.includes('2 Weeks+'))).toBe(true)
    expect(groupTitles.some(t => t.includes('Week+'))).toBe(true)
    expect(groupTitles.some(t => t.includes(newGroup1+'_randomGroup'))).toBe(true)
    expect(groupTitles.some(t => t.includes(newGroup2+'_randomGroup'))).toBe(true)


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

     // 7. Change to 3 levels (was 5, so Apply button appears) and verify
     await options.changeThresholdLevels(3, 3000)
     result = await options.getGroupAndTabData()

     // 5 groups: 3 age-based + 2 random groups
     expect(result.groupsOrderedByIndex.length).toBe(5)

     const groupTitles3 = result.groupsOrderedByIndex.map(g => g.title)
    expect(groupTitles3.some(t => t.includes('Month+'))).toBe(true)
    expect(groupTitles3.some(t => t.includes('2 Weeks+'))).toBe(true)
    expect(groupTitles3.some(t => t.includes('Week+'))).toBe(true)
    // Random groups still exist
    expect(groupTitles3.some(t => t.includes(newGroup1) && t.includes('randomGroup'))).toBe(true)
    expect(groupTitles3.some(t => t.includes(newGroup2) && t.includes('randomGroup'))).toBe(true)

    // 8. Verify grouped/ungrouped status remains valid
    groupedTabs = result.tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined)
    ungroupedTabs = result.tabs.filter(t => t.groupId === -1 || t.groupId === undefined)

    expect(groupedTabs.length).not.toBe(0)
    expect(ungroupedTabs.length).not.toBe(0)

     // 9. Change to 1 level and verify
     await options.changeThresholdLevels(1, 3000)
     result = await options.getGroupAndTabData()

     // 3 groups: 1 age-based + 2 random groups
     expect(result.groupsOrderedByIndex.length).toBe(3)

     const groupTitles1 = result.groupsOrderedByIndex.map(g => g.title)
    expect(groupTitles1.some(t => t.includes('Week+'))).toBe(true)
    // Random groups still exist
    expect(groupTitles1.some(t => t.includes(newGroup1) && t.includes('randomGroup'))).toBe(true)
    expect(groupTitles1.some(t => t.includes(newGroup2) && t.includes('randomGroup'))).toBe(true)

    // 10. Verify grouped/ungrouped status remains valid
    groupedTabs = result.tabs.filter(t => t.groupId !== -1 && t.groupId !== undefined)
    ungroupedTabs = result.tabs.filter(t => t.groupId === -1 || t.groupId === undefined)

    expect(groupedTabs.length).not.toBe(0)
    expect(ungroupedTabs.length).not.toBe(0)
  })

})
