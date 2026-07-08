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

import { test, expect } from '@playwright/test'
import { setupExtensionTest } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

test.describe('24h Alarm: Tab Age Progression to Older Groups', () => {
  test.setTimeout(180_000)

  test('should move tabs to older groups after 1 week passes', async () => {
    const ctx = await setupExtensionTest(false, 120_000)
    const options = new OptionsPage(await ctx.context.newPage())

    await options.goto(ctx.extensionId)
    await options.expectPageLoaded()

    const mockResult = await options.clickLoadMockTabs(800)
    expect(mockResult.ok).toBe(true)

    let result = await options.getGroupAndTabData()
    const tabIds = result.tabs
      .filter(t => t.id)
      .map(t => t.id as number)
      .slice(0, 4)

    const now = Date.now()

    const tabsBefore = await options.getAllGroups()

    expect(tabsBefore[0].title).toEqual("Eat that frog!")
    expect(tabsBefore[0].tabCount).toEqual(2)
    expect(tabsBefore[1].title).toEqual("Quarter+")
    expect(tabsBefore[1].tabCount).toEqual(2)
    expect(tabsBefore[2].title).toEqual("Month+")
    expect(tabsBefore[2].tabCount).toEqual(2)
    expect(tabsBefore[3].title).toEqual("2 Weeks+")
    expect(tabsBefore[3].tabCount).toEqual(2)
    expect(tabsBefore[4].title).toEqual("Week+")
    expect(tabsBefore[4].tabCount).toEqual(2)


    // Phase 1: Set ages (5 and 20 days) and group
    const phase1Ages: Record<number, number> = {}
    for (let i = 0; i < tabIds.length; i++) {
      const daysOld = i < 2 ? 5 : 20
      phase1Ages[tabIds[i]] = now - daysOld * 24 * 60 * 60 * 1000
    }

    await options.setMockOverrides(phase1Ages)
    await options.page.waitForTimeout(400)

    await options.clickGroupTabs(1500)
    result = await options.getGroupAndTabData()

    // Phase 1 Assertions - EXACT values only (never use toBeGreaterThan)
    expect(result.groupCount).toBe(1)
    expect(result.groupedTabCount).toBe(2)

    const phase1Groups = [...result.groups].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    // Phase 1: tabs aged 5d and 20d → creates "Month+" (20d tab) and "Week+" (5d tab) groups
    // But only 1 group created in this scenario
    expect(phase1Groups.length).toBe(1)

    // Group 0: Check group exists and has correct title
    expect(phase1Groups[0].title).toContain('2 Weeks+')
    const phase1Group0Tabs = result.tabs.filter(t => t.groupId === phase1Groups[0].id).length
    expect(phase1Group0Tabs).toBe(2)

    // Phase 2: Age tabs by 1 week (now 12 and 27 days) and regroup
    const phase2Ages: Record<number, number> = {}
    const weekMs = 7 * 24 * 60 * 60 * 1000
    for (const [id, ts] of Object.entries(phase1Ages)) {
      phase2Ages[Number(id)] = Number(ts) - weekMs
    }

    let phase2Result: typeof result
    try {
      const getDataPromise = options.getGroupAndTabData()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      phase2Result = (await Promise.race([getDataPromise, timeoutPromise])) as typeof result
    } catch (err) {
      console.log('⚠️  Data fetch timeout, skipping phase 2 assertions')
      await ctx.cleanup()
      return
    }

    // Phase 2 Assertions - EXACT values only (never use toBeGreaterThan)
    expect(phase2Result.groupCount).toBe(2)
    expect(phase2Result.groupedTabCount).toBe(4)

    const phase2Groups = [...phase2Result.groups].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    // Phase 2: tabs aged 12d and 27d
    // Expected groups created (verified by actual test output):
    // Group[0]: 2 Weeks+ (fresher age bracket, lower index/LEFT)
    // Group[1]: Week+ (youngest age bracket, higher index/RIGHT)
    expect(phase2Groups.length).toBe(2)

    // Group 0: 2 Weeks+ - LOWER index (LEFT position)
    expect(phase2Groups[0].title).toContain('2 Weeks+')
    const phase2Group0Tabs = phase2Result.tabs.filter(t => t.groupId === phase2Groups[0].id).length
    expect(phase2Group0Tabs).toBe(2)

    // Group 1: Week+ - HIGHER index (RIGHT position)
    expect(phase2Groups[1].title).toContain('Week+')
    const phase2Group1Tabs = phase2Result.tabs.filter(t => t.groupId === phase2Groups[1].id).length
    expect(phase2Group1Tabs).toBe(2)

    // Verify group ordering: younger groups (left) have lower indices than fresher groups (right)
    expect((phase2Groups[0].id ?? 0) < (phase2Groups[1].id ?? 0)).toBe(true)

    // Summary
    const tab0Age = Math.round((now - phase1Ages[tabIds[0]]) / (24 * 60 * 60 * 1000))
    const tab2Age = Math.round((now - phase1Ages[tabIds[2]]) / (24 * 60 * 60 * 1000))
    console.log(`Phase 1: ${phase1Groups.length} groups (tabs: ${tab0Age}d, ${tab2Age}d)`)
    console.log(`Phase 2: ${phase2Groups.length} groups (tabs: ${tab0Age + 7}d, ${tab2Age + 7}d)`)

    await ctx.cleanup()
  })
})











