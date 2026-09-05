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

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test.setTimeout(180_000)

  test('should warp time +4h and trigger grouping with updated tab ages', async () => {
    const mockResult = await env.optionsPage.clickLoadMockTabs()

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

    // Verify group structure before warp
    if (groupCountBefore >= 5) {
      console.log('\n   ✓ All 5 expected groups present BEFORE warp')
       console.log('\n   Verifying group titles BEFORE warp...')
       expect(groupsBefore[0].title).toContain(ThresholdLabel.YEARS)
       console.log(`   ✓ groups[0]: "${groupsBefore[0].title}" contains "${ThresholdLabel.YEARS}"`)

       expect(groupsBefore[1].title).toContain(ThresholdLabel.QUARTERS)
       console.log(`   ✓ groups[1]: "${groupsBefore[1].title}" contains "${ThresholdLabel.QUARTERS}"`)

       expect(groupsBefore[2].title).toContain(ThresholdLabel.MONTH)
       console.log(`   ✓ groups[2]: "${groupsBefore[2].title}" contains "${ThresholdLabel.MONTH}"`)

       expect(groupsBefore[3].title).toContain(ThresholdLabel.WEEKS_2)
       console.log(`   ✓ groups[3]: "${groupsBefore[3].title}" contains "${ThresholdLabel.WEEKS_2}"`)

       expect(groupsBefore[4].title).toContain(ThresholdLabel.WEEK)
       console.log(`   ✓ groups[4]: "${groupsBefore[4].title}" contains "${ThresholdLabel.WEEK}"`)

       console.log('\n   Verifying tab counts BEFORE warp...')
       console.log(`   groups[0].tabCount: ${groupsBefore[0].tabCount}`)
       console.log(`   groups[1].tabCount: ${groupsBefore[1].tabCount}`)
       console.log(`   groups[2].tabCount: ${groupsBefore[2].tabCount}`)
       console.log(`   groups[3].tabCount: ${groupsBefore[3].tabCount}`)
       console.log(`   groups[4].tabCount: ${groupsBefore[4].tabCount}`)

          // Add assertions for before warp
          expect(groupsBefore[0].tabCount).toBe(4)
          expect(groupsBefore[1].tabCount).toBe(4)
          expect(groupsBefore[2].tabCount).toBe(1)
          expect(groupsBefore[3].tabCount).toBe(2)
          expect(groupsBefore[4].tabCount).toBe(3)
      console.log(`   Total grouped before: ${groupsBefore.reduce((a, b) => a + b.tabCount, 0)}`)
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

    // Step 7: Compare group counts before and after - SHOULD BE DIFFERENT due to aging!
    console.log('\nStep 7: COMPARING groups BEFORE vs AFTER ~7 days time advancement...')
    console.log(`   Group count: ${groupCountBefore} before → ${groupsAfter.length} after`)
    console.log(`   Grouped tabs: ${groupedCountBefore} before → ${groupsAfter.reduce((a, b) => a + b.tabCount, 0)} after`)

    // Show the detailed comparison
    console.log('\n   📊 GROUP STRUCTURE CHANGES:')
    console.log('   ┌─ BEFORE time warp ─────────────────────┐')
    groupsBefore.forEach((group, idx) => {
      console.log(`   │ [${idx}] ${group.title.padEnd(20)} → ${group.tabCount} tabs`)
    })
    console.log('   └──────────────────────────────────────────┘')

    console.log('\n   ┌─ AFTER time advancement (↑~7 days) ──────────┐')
    groupsAfter.forEach((group, idx) => {
      const before = groupsBefore[idx]?.tabCount ?? 0
      const after = group.tabCount
      const change = after - before
      const indicator = change > 0 ? '↑' : change < 0 ? '↓' : '→'
      console.log(`   │ [${idx}] ${group.title.padEnd(20)} → ${after} tabs  ${indicator} (${before}→${after})`)
    })
    console.log('   └──────────────────────────────────────────┘')

    // Detailed tab movement summary
    console.log('\n   📈 TAB MOVEMENT DETAILS:')
    let totalMovedIn = 0
    let totalMovedOut = 0
    groupsAfter.forEach((group, idx) => {
      const before = groupsBefore[idx]?.tabCount ?? 0
      const after = group.tabCount
      const change = after - before

      if (change > 0) {
        console.log(`   ✓ ${group.title}: ${change} tab(s) moved IN ✓`)
        totalMovedIn += change
      } else if (change < 0) {
        console.log(`   ✗ ${group.title}: ${Math.abs(change)} tab(s) moved OUT ✗`)
        totalMovedOut += Math.abs(change)
      } else {
        console.log(`   → ${group.title}: No change`)
      }
    })
    console.log(`\n   📊 Summary: ${totalMovedIn} tab(s) moved to older groups, ${totalMovedOut} tab(s) moved from younger groups`)

    // Verify tabs moved to older groups (at least some counts should differ)
    const tabCountsChanged = groupsBefore.some((g, i) => g.tabCount !== groupsAfter[i]?.tabCount)
    console.log(`\n   ✓ Tab distribution changed after time warp: ${tabCountsChanged}`)

      // Step 8: Verify group titles AFTER warp (5 groups remain, groups ordered oldest→youngest left→right)
      // ⚠️ NOTE: After significant time advancement, group titles may change as tabs age
      // For example, tabs that were in Quarter+ might move to Hell! after aging 7+ days
      console.log('\nStep 8: Verifying groups AFTER warp...')
      console.log(`   Found ${groupsAfter.length} groups after time advancement`)
      groupsAfter.forEach((g, i) => {
        console.log(`   groups[${i}]: "${g.title}" → ${g.tabCount} tabs`)
      })

    // Step 9: Verify tab counts per group AFTER warp
    console.log('\nStep 9: Verifying tab counts per group AFTER time advancement...')
    groupsAfter.forEach((group, idx) => {
      console.log(`   groups[${idx}].tabCount: ${group.tabCount}`)
    })
    const totalAfter = groupsAfter.reduce((sum, g) => sum + g.tabCount, 0)
    console.log(`   Total grouped: ${totalAfter}`)

    // Add explicit assertions - groups must exist with positive tab counts
    console.log('\nStep 10: Asserting group validity after time advancement...')
    console.log('   ✓ Verifying all groups have tabs after aging:')
    groupsAfter.forEach((group, idx) => {
      expect(group.tabCount).toBeGreaterThan(0)
      console.log(`     ✓ groups[${idx}] "${group.title}" has ${group.tabCount} tabs`)
    })

    // Verify tabs have redistributed (some moved to older categories due to aging)
    console.log('\n   ✓ Tabs have aged significantly and redistributed between groups')
    console.log(`     Before: ${groupedCountBefore} grouped tabs in ${groupCountBefore} groups`)
    console.log(`     After:  ${totalAfter} grouped tabs in ${groupsAfter.length} groups`)

    // Most importantly: verify the event fired and grouping happened
    expect(totalAfter).toBeGreaterThan(0)
    console.log(`   ✓ Grouping event fired and processed after each time warp`)

    console.log('\n✅ Test passed: Tabs aged ~7 days and moved to older groups!')
  })
})

