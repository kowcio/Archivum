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

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()

    // Load mocks with their default ages
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test.setTimeout(180_000)

  test('should move tabs to older groups after 1 week passes', async () => {

    // Phase 1: Group tabs with their default ages
    await env.optionsPage.clickGroupTabs()

    const ungroupedTabBefore = await env.optionsPage.getUngroupedTabs()

    // Phase 1 Assertions - EXACT values only (never use toBeGreaterThan)
    const tabsBefore = await env.optionsPage.getAllGroups()

    const hellGroupIndex = tabsBefore.findIndex(g => g.title.includes("Hell!"))
    console.log("Hell! group index:", hellGroupIndex)

    expect(tabsBefore[0].title).toContain("Hell!")
    expect(tabsBefore[0].tabCount).toBe(4)

    expect(tabsBefore[1].title).toContain("Quarter+")
    expect(tabsBefore[1].tabCount).toBe(4)

    expect(tabsBefore[2].title).toContain("Month+")
    expect(tabsBefore[2].tabCount).toBe(1)

    expect(tabsBefore[3].title).toContain("2 Weeks+")
    expect(tabsBefore[3].tabCount).toBe(2)

    expect(tabsBefore[4].title).toContain("Week+")
    expect(tabsBefore[4].tabCount).toBe(3)

    // Phase 2: Apply time progression and trigger 24h alarm
    // Age all mocks by 1 week using the new timeProgress helper
    // Trigger the 24h alarm which ungroups and regroups tabs by new ages

    //WHEN
    await env.optionsPage.timeProgress(7)
    const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()

    //THEN
    const tabsAfter = await env.optionsPage.getAllGroups()
    expect(tabsAfter.length).toBe(5)

    const groupedTabsAfter = await env.optionsPage.getGroupedTabs()
    const ungroupTabsAfter = await env.optionsPage.getUngroupedTabs()

    // Dynamic assertions - copy actual values from console logs above
    expect(groupedTabsAfter.length + ungroupTabsAfter.length).toBe(18)

    expect(tabsAfter[0].title).toContain("Hell!")
    expect(tabsAfter[0].tabCount).toBe(tabsBefore[0].tabCount + 2)

    expect(tabsAfter[1].title).toContain("Quarter+")
    expect(tabsAfter[1].tabCount).toBe(tabsBefore[1].tabCount - 2)

    expect(tabsAfter[2].title).toContain("Month+")
    expect(tabsAfter[2].tabCount).toBe(tabsBefore[2].tabCount + 1)

    expect(tabsAfter[3].title).toContain("2 Weeks+")
    expect(tabsAfter[3].tabCount).toBe(tabsBefore[3].tabCount + 2)

    expect(tabsAfter[4].title).toContain("Week+")
    expect(tabsAfter[4].tabCount).toBe(tabsBefore[4].tabCount)

    const ungroupedTabAfter = await env.optionsPage.getUngroupedTabs()
    expect(ungroupedTabAfter.length).toBe(ungroupedTabBefore.length - 3)
  })
})

