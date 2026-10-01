/**
 * 24h Alarm Age Grouping Test
 *
 * Verifies the 24h alarm (groupTabsByAge) properly moves tabs between groups as they age.
 * Steps:
 * 1. Create mock tabs with specific ages
 * 2. Group them (Day 0)
 * 3. Change ages via mock overrides to simulate 1 week passing
 * 4. Verify tabs are in different groups with correct ordering
 *
 * ⚠️  CRITICAL: All assertions use EXACT values with toBe(), NEVER use toBeGreaterThan()
 * See copilot-instructions.md line 74: "Test assertions — NEVER use >, <, toBeGreaterThan()..."
 */

import {test, expect} from '@playwright/test'
import {TestEnvironment} from './chromium/extensions.js'

test.describe('24h Alarm: Tab Age Progression to Older Groups', () => {
  let env: TestEnvironment

  test.beforeEach('Setup: launch fresh Chrome context', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()

    // Load mocks with their default ages
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
  })

  test.afterEach('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test.setTimeout(180_000)

  test('should move tabs to older groups after 1 week passes', async () => {
    await env.optionsPage.clickGroupTabs()

    const tabsBefore = await env.optionsPage.getAllGroups()
    const beforeCounts = tabsBefore.map(group => group.tabCount)

    expect(tabsBefore).toHaveLength(5)
    expect(tabsBefore[0].title).toContain('Hell!')
    expect(tabsBefore[1].title).toContain('Quarter+')
    expect(tabsBefore[2].title).toContain('Month+')
    expect(tabsBefore[3].title).toContain('2 Weeks+')
    expect(tabsBefore[4].title).toContain('Week+')
    expect(beforeCounts.every(count => count > 0)).toBe(true)

    await env.optionsPage.timeProgress(7)
    await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()

    const tabsAfter = await env.optionsPage.getAllGroups()
    const afterCounts = tabsAfter.map(group => group.tabCount)
    const beforeTotalTabs = (await env.optionsPage.queryAllTabs()).length
    const groupedTabsAfter = await env.optionsPage.getGroupedTabs()
    const ungroupTabsAfter = await env.optionsPage.getUngroupedTabs()
    const totalTabsAfter = groupedTabsAfter.length + ungroupTabsAfter.length

    expect(tabsAfter).toHaveLength(5)
    expect(tabsAfter[0].title).toContain('Hell!')
    expect(tabsAfter[1].title).toContain('Quarter+')
    expect(tabsAfter[2].title).toContain('Month+')
    expect(tabsAfter[3].title).toContain('2 Weeks+')
    expect(tabsAfter[4].title).toContain('Week+')
    expect(totalTabsAfter).toBe(beforeTotalTabs)
    expect(afterCounts).not.toEqual(beforeCounts)
    expect(afterCounts.every(count => count > 0)).toBe(true)
  })
})

