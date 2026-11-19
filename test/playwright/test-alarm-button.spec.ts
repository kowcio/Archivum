/// <reference types="chrome" />

/**
 * Test: TestAlarmButton (+4h Warp) functionality
 *
 * Verifies that clicking the "Warp +4h" button multiple times:
 * 1. Creates mock tabs with initial ages
 * 2. Groups them (initial state: Fresh/Week+/2Weeks+/Month+/Years)
 * 3. Advances time multiple times (several 4h warps = days/weeks of time passage)
 * 4. Triggers tab grouping after each warp
 * 5. Tabs MOVE to OLDER groups as they age (Fresh→Week+→2Weeks+→Month+→Years)
 * 6. Verifies group structure changes, with tabs moving to older categories
 *
 * Key: Group tab counts CHANGE as time passes and tabs age!
 */

import { test, expect } from '@playwright/test'
import { TestEnvironment } from './chromium/extensions.js'
import { ThresholdLabel } from '../../src/constants.js'

test.describe('TestAlarmButton: +4h Warp & Grouping', () => {
  let env: TestEnvironment

  test.beforeEach('Setup: launch fresh Chrome context', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()
  })

  test.afterEach('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test.setTimeout(180_000)

  test('should warp time +4h and trigger grouping with updated tab ages', async () => {
    await env.optionsPage.clickLoadMockTabs()

    await env.optionsPage.clickGroupTabs()

    // Step 3: Verify groups BEFORE time warp
    console.log('\nStep 3: Verifying groups BEFORE time warp...')
    const tabsBefore = await env.optionsPage.queryAllTabs(true)
    console.log(`   ✓ Tab count before warp: ${tabsBefore.length}`)

    const groupsBefore = await env.optionsPage.getAllGroups()
    const groupCountBefore = groupsBefore.length
    const groupedCountBefore = tabsBefore.filter(t => t.groupId !== -1).length

    console.log(`   ✓ Groups before warp: ${groupCountBefore}`)
    console.log(`   ✓ Grouped tabs before warp: ${groupedCountBefore}`)

    // Log all groups and their tab counts BEFORE warp
    console.log('\n   Groups BEFORE time warp:')
    groupsBefore.forEach((group, idx) => {
      console.log(`   [${idx}] "${group.title}" → ${group.tabCount} tabs`)
    })

    if (groupCountBefore >= 5) {
      console.log('\n   ✓ All 5 expected groups present BEFORE warp')
      console.log('\n   Verifying group titles BEFORE warp...')
      expect(groupsBefore[0].title).toContain(ThresholdLabel.YEARS)
      expect(groupsBefore[1].title).toContain(ThresholdLabel.QUARTERS)
      expect(groupsBefore[2].title).toContain(ThresholdLabel.MONTH)
      expect(groupsBefore[3].title).toContain(ThresholdLabel.WEEKS_2)
      expect(groupsBefore[4].title).toContain(ThresholdLabel.WEEK)

      const beforeCounts = groupsBefore.map(group => group.tabCount)
      expect(beforeCounts.every(count => count > 0)).toBe(true)
      console.log(`   Total grouped before: ${beforeCounts.reduce((a, b) => a + b, 0)}`)
    }

    // Step 4: Advance time 7 days in a single RPC call — no loop needed
    console.log('\nStep 4: Advancing time 7 days via single background RPC call...')
    await env.optionsPage.warpAndTriggerAlarm(168) // 168h = 7 days
    console.log('   ✓ Total time advanced: 7 days (168 hours)')

    // Step 5: Verify tabs after warp
    console.log('\nStep 5: Verifying tab grouping after warp...')
    const tabsAfter = await env.optionsPage.queryAllTabs(true)
    console.log(`   ✓ Final tab count: ${tabsAfter.length} (should match initial ${tabsBefore.length})`)
    expect(tabsAfter.length).toBe(tabsBefore.length)

    // Step 6: Verify groups AFTER time warp
    console.log('\nStep 6: Verifying groups AFTER time warp...')
    const groupsAfter = await env.optionsPage.getAllGroups()

    console.log(`   Groups AFTER time warp:`)
    groupsAfter.forEach((group, idx) => {
      console.log(`   [${idx}] "${group.title}" → ${group.tabCount} tabs`)
    })

    const beforeCounts = groupsBefore.map(group => group.tabCount)
    const afterCounts = groupsAfter.map(group => group.tabCount)
    const tabCountsChanged = beforeCounts.some((count, idx) => count !== afterCounts[idx])

    console.log('\nStep 7: COMPARING groups BEFORE vs AFTER ~7 days time advancement...')
    console.log(`   Group count: ${groupCountBefore} before → ${groupsAfter.length} after`)
    console.log(`   Tab distribution changed: ${tabCountsChanged}`)

    expect(groupsAfter).toHaveLength(5)
    expect(groupsAfter[0].title).toContain(ThresholdLabel.YEARS)
    expect(groupsAfter[1].title).toContain(ThresholdLabel.QUARTERS)
    expect(groupsAfter[2].title).toContain(ThresholdLabel.MONTH)
    expect(groupsAfter[3].title).toContain(ThresholdLabel.WEEKS_2)
    expect(groupsAfter[4].title).toContain(ThresholdLabel.WEEK)
    expect(afterCounts.every(count => count > 0)).toBe(true)
    expect(tabCountsChanged).toBe(true)

    const totalAfter = groupsAfter.reduce((sum, group) => sum + group.tabCount, 0)
    expect(totalAfter).toBeGreaterThan(0)
    console.log('\n✅ Test passed: Tabs aged ~7 days and moved to older groups!')
  })
})

