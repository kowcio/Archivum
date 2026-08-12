/**
 * 🔍 DEBUGGING EXAMPLE: How to spy on BackgroundTabService during tests
 *
 * This file shows various techniques to inspect what's happening in the
 * background service worker while your tests run.
 *
 * Usage: Copy patterns from here into your test files to debug issues.
 *
 * ✅ Methods available:
 *   1. spyOnBackgroundState() → Get JSON diagnostic data
 *   2. spyLogState(label?) → Pretty-print diagnostics to console
 *   3. Service worker console logs (automatic via setupServiceWorkerLogging)
 */

import { test, expect } from '@playwright/test'
import { TestEnvironment } from './chromium/extensions.js'

test.describe('🔍 EXAMPLE: Spying on BackgroundTabService', () => {
  let env: TestEnvironment

  test.beforeAll('Setup extension', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.goto(env.extensionId)
    await env.optionsPage.expectPageLoaded()
  })

  test.afterAll('Cleanup', async () => {
    if (env) await env.cleanup()
  })

  // ✅ EXAMPLE 1: Spy before and after grouping
  test('EXAMPLE: Check tab states before/after grouping', async () => {
    // Load mock tabs
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

    // BEFORE grouping: spy on state
    console.log('\n=== BEFORE GROUPING ===')
    await env.optionsPage.spyLogState('Before Group')
    const stateBefore = await env.optionsPage.spyOnBackgroundState()
    const tabCountBefore = stateBefore.allTabs.length
    const groupCountBefore = stateBefore.allGroups.length

    // Group tabs
    await env.optionsPage.clickGroupTabs()
    await new Promise(r => setTimeout(r, 500)) // Wait for grouping

    // AFTER grouping: spy on state
    console.log('\n=== AFTER GROUPING ===')
    await env.optionsPage.spyLogState('After Group')
    const stateAfter = await env.optionsPage.spyOnBackgroundState()
    const tabCountAfter = stateAfter.allTabs.length
    const groupCountAfter = stateAfter.allGroups.length

    // Verify
    console.log(`\n📊 Summary:`)
    console.log(`   Tabs: ${tabCountBefore} → ${tabCountAfter}`)
    console.log(`   Groups: ${groupCountBefore} → ${groupCountAfter}`)
    expect(tabCountAfter).toBeGreaterThan(0)
    expect(groupCountAfter).toBeGreaterThan(groupCountBefore)
  })

  // ✅ EXAMPLE 2: Spy during auto-close operation
  test('EXAMPLE: Monitor tabs during auto-close', async () => {
    // Setup
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

    // Enable auto-close
    await env.optionsPage.getBackgroundRPC().storeSetAutoClose(true)
    console.log('✅ Auto-close ENABLED')

    // Group tabs
    await env.optionsPage.clickGroupTabs()
    await env.optionsPage.spyLogState('After Grouping')

    const stateBefore = await env.optionsPage.spyOnBackgroundState()
    console.log(`\n📍 Oldest group before close: "${stateBefore.oldestGroupInfo?.title}"`)
    console.log(`   Tabs in oldest group: ${stateBefore.tabsInOldestGroup.length}`)
    console.log(`   Tab ages: ${stateBefore.tabsInOldestGroup.map(t => `${t.age}d`).join(', ')}`)

    // Trigger alarm (this triggers auto-close)
    console.log('\n🔔 Triggering auto-close alarm...')
    const closedCount = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
    console.log(`✅ Alarm returned: ${closedCount} (may not reflect tabs closed if auto-close is disabled)`)

    await new Promise(r => setTimeout(r, 500)) // Wait for async operations

    // Spy AFTER close
    const stateAfter = await env.optionsPage.spyOnBackgroundState()
    await env.optionsPage.spyLogState('After Auto-Close')

    console.log(`\n📊 Comparison:`)
    console.log(`   Tabs before: ${stateBefore.allTabs.length}`)
    console.log(`   Tabs after: ${stateAfter.allTabs.length}`)
    console.log(`   Oldest group before: "${stateBefore.oldestGroupInfo?.title}"`)
    console.log(`   Oldest group after: "${stateAfter.oldestGroupInfo?.title}"`)
  })

  // ✅ EXAMPLE 3: Continuous monitoring during repeated alarms
  test('EXAMPLE: Monitor state through multiple alarm cycles', async () => {
    // Setup
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

    await env.optionsPage.getBackgroundRPC().storeSetAutoClose(false) // Disable auto-close to just group
    await env.optionsPage.clickGroupTabs()

    console.log('\n=== MONITORING 3 ALARM CYCLES ===')
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n--- Cycle ${cycle} ---`)

      // Get state before
      const before = await env.optionsPage.spyOnBackgroundState()
      console.log(`Before: ${before.allTabs.length} tabs, ${before.allGroups.length} groups`)
      console.log(`  Groups: ${before.allGroups.map(g => `${g.title}(idx:${g.index})`).join(' → ')}`)

      // Trigger alarm
      await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
      await new Promise(r => setTimeout(r, 300))

      // Get state after
      const after = await env.optionsPage.spyOnBackgroundState()
      console.log(`After:  ${after.allTabs.length} tabs, ${after.allGroups.length} groups`)
      console.log(`  Groups: ${after.allGroups.map(g => `${g.title}(idx:${g.index})`).join(' → ')}`)

      // Warp time by 1 day
      await env.optionsPage.getBackgroundRPC().addTimeWarp(86400000)
      console.log(`⏰ Time warped +1 day`)
    }
  })

  // ✅ EXAMPLE 4: Get raw diagnostic data for assertions
  test('EXAMPLE: Use diagnostics for precise assertions', async () => {
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

    // Get diagnostics as structured data
    const diagnostics = await env.optionsPage.spyOnBackgroundState()

    // Now you can make specific assertions about the data
    console.log('\n📋 Structured Diagnostics for Assertions:')
    console.log(`   Total tabs: ${diagnostics.allTabs.length}`)
    console.log(`   Total groups: ${diagnostics.allGroups.length}`)

    // Find all tabs older than 10 days
    const oldTabs = diagnostics.allTabs.filter(t => {
      if (!t.lastAccessed) return false
      const now = Date.now()
      const ageDays = (now - t.lastAccessed) / 86400000
      return ageDays > 10
    })
    console.log(`   Tabs older than 10 days: ${oldTabs.length}`)

    // Count tabs in each group
    const tabsByGroup: Record<number, number> = {}
    diagnostics.allTabs.forEach(t => {
      if (t.groupId != null && t.groupId !== -1) {
        tabsByGroup[t.groupId] = (tabsByGroup[t.groupId] || 0) + 1
      }
    })
    console.log(`   Tabs per group:`, tabsByGroup)

    // Make assertions
    expect(diagnostics.allTabs.length).toBeGreaterThan(0)
  })
})

/**
 * 🎯 KEY TECHNIQUES:
 *
 * 1. QUICK STATE CHECK:
 *    await env.optionsPage.spyLogState('Label')
 *    → Pretty-prints to console, easier to read during debugging
 *
 * 2. PROGRAMMATIC ACCESS:
 *    const state = await env.optionsPage.spyOnBackgroundState()
 *    → Use in assertions or conditional logic
 *
 * 3. WATCH SERVICE WORKER LOGS:
 *    - Already captured automatically via setupServiceWorkerLogging()
 *    - Look for [BackgroundTabService] prefixed messages
 *    - Check for [SW_ERROR] for errors
 *
 * 4. COMBINE WITH CONSOLE MONITORING:
 *    Run: npm run test:24h-alarm -- --headed
 *    → Keep DevTools open to see console.log() calls in real-time
 *
 * 5. INSPECT SPECIFIC GROUPS:
 *    const state = await env.optionsPage.spyOnBackgroundState()
 *    console.log(state.oldestGroupInfo) // Oldest group details
 *    console.log(state.tabsInOldestGroup) // Tabs about to be closed
 */
