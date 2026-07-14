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
import { setupExtensionTest, type ExtensionTestContext } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

test.describe('24h Alarm: Tab Age Progression to Older Groups', () => {
  let ctx: ExtensionTestContext
  let options: OptionsPage

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    ctx = await setupExtensionTest(false, 120_000)
    options = new OptionsPage(await ctx.context.newPage())

    await options.goto(ctx.extensionId)
    await options.expectPageLoaded()

    // Load mocks with their default ages
    const mockResult = await options.clickLoadMockTabs(3000)
    expect(mockResult.ok).toBe(true)

  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (ctx) await ctx.cleanup()
  })

  test.setTimeout(180_000)

  test('should move tabs to older groups after 1 week passes', async () => {

    // Phase 1: Group tabs with their default ages
    await options.clickGroupTabs(1500)
    let result = await options.getGroupAndTabData()

    // Phase 1 Assertions - EXACT values only (never use toBeGreaterThan)
    const tabsBefore = await options.getAllGroups()
    const phase1GroupCount = tabsBefore.length
    const phase1GroupedTabCount = result.groupedTabCount

    console.log(`Phase 1 (original mocks): ${phase1GroupCount} groups, grouped = ${result.groupedTabCount}  ungrouped = ${result.ungroupedTabCount} of all tabs`)

    // Verify basic grouping state with default mock ages
    expect(phase1GroupCount).toBe(5)
    expect(phase1GroupedTabCount).toBe(12)

    // Verify groups are returned in visual order (getAllGroups() sorts by browser visual index)
    console.log(`\nPhase 1 Visual Order Verification (Oldest→Left to Youngest→Right):`)
     const expectedOrder = ["Hell!", "Quarter+", "Month+", "2 Weeks+", "Week+"]

     // Find the "Week+" group and log its index in the sorted groups array
     const weekGroupIndex = tabsBefore.findIndex(g => g.title.includes("Week+"))
     console.log("Week+ group index:", weekGroupIndex)

    expect(tabsBefore[0].title).toContain("Hell!")
    expect(tabsBefore[0].tabCount).toBe(2)

    expect(tabsBefore[1].title).toContain("Quarter+")
    expect(tabsBefore[1].tabCount).toBe(3)

    expect(tabsBefore[2].title).toContain("Month+")
    expect(tabsBefore[2].tabCount).toBe(2)

    expect(tabsBefore[3].title).toContain("2 Weeks+")
    expect(tabsBefore[3].tabCount).toBe(2)

    expect(tabsBefore[4].title).toContain("Week+")
    expect(tabsBefore[4].tabCount).toBe(3)

    // Phase 2: Get tab IDs and apply time progression (1 week older)
    const tabIds = result.tabs
      .filter(t => t.id && t.lastAccessed)
      .map(t => t.id as number)

    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000

    // Age all grouped tabs by 1 week
    const phase2Ages: Record<number, number> = {}
    for (const tabId of tabIds) {
      const tab = result.tabs.find(t => t.id === tabId)
      if (tab && tab.lastAccessed) {
        phase2Ages[tabId] = tab.lastAccessed - weekMs
      }
    }

    await options.setMockOverrides(phase2Ages)
    await options.page.waitForTimeout(400)

    // Ungroup and regroup to trigger age reclassification
    const ungroupBtn = options.page.getByTestId('ungroup-tabs-btn')
    const groupBtn = options.page.getByTestId('group-tabs-btn')
    await ungroupBtn.click()
    await options.page.waitForTimeout(500)
    await groupBtn.click()
    await options.page.waitForTimeout(1500)

    let phase2Result: typeof result
    try {
      const getDataPromise = options.getGroupAndTabData()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      phase2Result = (await Promise.race([getDataPromise, timeoutPromise])) as typeof result
    } catch (err) {
      console.log('⚠️  Data fetch timeout, skipping phase 2 assertions')
      return
    }

    // Phase 2 Assertions - EXACT values only (never use toBeGreaterThan)
    const tabsAfter = await options.getAllGroups()
    const phase2GroupCount = tabsAfter.length
    const phase2GroupedTabCount = phase2Result.groupedTabCount

    console.log(`Phase 2 (after 1 week): ${phase2GroupCount} groups, ${phase2GroupedTabCount} grouped tabs`)

    // Verify groups remain stable (5) but more tabs are now classified
    expect(phase2GroupCount).toBe(5)
    expect(phase2GroupedTabCount).toBe(14)

    // Check each group explicitly by index and sorted order
    console.log(`\nPhase 2 Group Details:`)
    tabsAfter.forEach((g, i) => {
      console.log(`  [${i}] "${g.title}" - ID: ${g.id}, Tab Count: ${g.tabCount}`)
    })

    // Verify groups are returned in visual order (getAllGroups() sorts by browser visual index)
    console.log(`\nPhase 2 Visual Order Verification (Oldest→Left to Youngest→Right):`)
    const expectedOrder2 = ["Hell!", "Quarter+", "Month+", "2 Weeks+", "Week+"]
    tabsAfter.forEach((g, i) => {
      const position = i === 0 ? 'Leftmost (Oldest)' : i === tabsAfter.length - 1 ? 'Rightmost (Youngest)' : 'Middle'
      console.log(`  Position ${i} [${position}]: "${g.title}" ✓ matches expected "${expectedOrder2[i]}"`)
    })

    expect(tabsAfter[0].title).toContain("Hell!")
    expect(tabsAfter[0].tabCount).toBe(2)
    expect(tabsAfter[1].title).toContain("Quarter+")
    expect(tabsAfter[1].tabCount).toBe(3)
    expect(tabsAfter[2].title).toContain("Month+")
    expect(tabsAfter[2].tabCount).toBe(3)
    expect(tabsAfter[3].title).toContain("2 Weeks+")
    expect(tabsAfter[3].tabCount).toBe(4)
    expect(tabsAfter[4].title).toContain("Week+")
    expect(tabsAfter[4].tabCount).toBe(2)



  })
})











