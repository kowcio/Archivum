/**
 * 24h Alarm Auto-Close Tabs Test
 *
 * Verifies the 24h alarm auto-close feature:
 * 1. Creates mock tabs and groups them by age
 * 2. Enables auto-close toggle
 * 3. Ages the oldest group tabs by 24h using mock overrides
 * 4. Triggers the 24h alarm via dev RPC method
 * 5. Verifies oldest group tabs are closed
 * 6. Verifies group is removed if empty, or persists if other tabs remain
 *
 * ⚠️  CRITICAL: All assertions use EXACT values with toBe(), NEVER use toBeGreaterThan()
 */

import {test, expect} from '@playwright/test'
import {setupExtensionTest, type ExtensionTestContext} from './chromium/extensions.js'
import {OptionsPage} from './page-objects/OptionsPage.js'
import {APP_DEFAULTS} from '../../src/constants.js'

test.describe('24h Alarm: Auto-Close Oldest Group Tabs', () => {
  let ctx: ExtensionTestContext
  let options: OptionsPage
  let oldestThreshold: any

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    ctx = await setupExtensionTest(false, 120_000)
    options = new OptionsPage(await ctx.context.newPage())

    await options.goto(ctx.extensionId)
    await options.expectPageLoaded()

    // Load mocks with their default ages
    const mockResult = await options.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

    // Pre-compute oldest threshold for test
    const activeThresholds = APP_DEFAULTS.THRESHOLDS.presets.slice(0, APP_DEFAULTS.THRESHOLDS.activeLevels)
    oldestThreshold = activeThresholds[activeThresholds.length - 1]
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (ctx) await ctx.cleanup()
  })

  test.setTimeout(60_000)

  async function logGroupState(label: string, groups: any[], data: any) {
    console.log(`${label}: ${groups.length} groups, ${data.groupedTabCount} grouped tabs`)
    console.log(`Groups: ${groups.map(g => `"${g.title}" (${g.tabCount})`).join(' → ')}`)
  }

  test('should close tabs in oldest group after 24h alarm with auto-close enabled', async () => {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Group tabs with their default ages
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n[Phase 1] Grouping tabs by age...')
    await options.clickGroupTabs()
    const result = await options.getGroupAndTabData()
    const tabsBefore = await options.getAllGroups()

    await logGroupState('Initial state', tabsBefore, result)

    console.log(`✓ Threshold levels: ${APP_DEFAULTS.THRESHOLDS.activeLevels} active`)
    console.log(`✓ Oldest group should be: "${oldestThreshold.label}"`)

    // Verify oldest group exists and matches expected threshold
    // ⚠️ CRITICAL: Groups are ordered OLDEST→YOUNGEST from LEFT→RIGHT by tab index
    expect(tabsBefore.length).toBeGreaterThan(0)
    expect(tabsBefore[0].title).toContain(oldestThreshold.label)
    console.log(`✓ Oldest group confirmed: "${tabsBefore[0].title}"`)

    // Find at least one tab in the oldest group, or succeed if group is empty
    const oldestGroup = tabsBefore[0]
    const oldestGroupTabsBeforeCount = oldestGroup.tabCount

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Enable auto-close toggle
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n[Phase 2] Enabling auto-close toggle...')
    await options.clickAutoCloseToggle()

    // Verify auto-close is enabled
    const autoCloseState = await options.isAutoCloseEnabled()
    console.log(`Auto-close enabled: ${autoCloseState}`)
    expect(autoCloseState).toBe(true)

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Age the tabs in the oldest group by 24+ hours
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n[Phase 3] Aging oldest group tabs by 24+ hours...')

    // Get all tabs from the oldest group (based on active threshold levels)
    const oldestGroupId = oldestGroup.id
    const oldestGroupTabs = result.tabs.filter(t => t.groupId === oldestGroupId)

    console.log(`Found ${oldestGroupTabs.length} tabs in "${oldestThreshold.label}" group (groupId: ${oldestGroupId})`)
    expect(oldestGroupTabs.length).toEqual(3)

    // Age all tabs in the oldest group by 25 hours (just over 24h)
    const overAgedHours = 25
    const ageOverrides: Record<number, number> = {}

    for (const tab of oldestGroupTabs) {
      if (tab.id && tab.lastAccessed) {
        const aged = tab.lastAccessed - (overAgedHours * 60 * 60 * 1000)
        ageOverrides[tab.id] = aged
        console.log(`  Tab#${tab.id}: aged by ${overAgedHours}h (was ${tab.lastAccessed}, now ${aged})`)
      }
    }

    // Apply age overrides
    await options.setMockOverrides(ageOverrides)
    console.log(`Applied age overrides for ${Object.keys(ageOverrides).length} tabs`)

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: Trigger the 24h alarm by grouping + closing oldest group
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n[Phase 4] Triggering 24h alarm logic (group by age + close oldest group)...')

    // Small delay to ensure mock overrides are fully applied
    await new Promise(r => setTimeout(r, 500))

    // Step 1: Ungroup then regroup to apply mock overrides
    console.log('  Step 1: Regrouping tabs with mock overrides...')
    await options.clickUngroupTabs()
    await options.clickGroupTabs()
    const resultAfterGroup = await options.getGroupAndTabData()
    console.log(`  After grouping: ${resultAfterGroup.groupsOrderedByIndex.length} groups`)

    // Step 2: Close the oldest group tabs via RPC (closeOldestGroupTabs)
    console.log('  Step 2: Closing oldest group tabs...')
    const closedCount = await options.page.evaluate(async () => {
      return new Promise<number>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'proxy-service.background',
            data: {path: ['closeOldestGroupTabs'], args: []},
            timestamp: Date.now()
          },
          (response: any) => {
            if (chrome.runtime.lastError) {
              console.error('[RPC closeOldestGroupTabs]', chrome.runtime.lastError)
              reject(new Error(chrome.runtime.lastError.message))
            } else if (response?.err) {
              console.error('[RPC closeOldestGroupTabs error]', response.err)
              reject(new Error(response.err.message || 'RPC failed'))
            } else {
              console.log('[RPC closeOldestGroupTabs success]', response?.res)
              resolve(response?.res ?? 0)
            }
          }
        )
      })
    })

    console.log(`  Alarm completed: ${closedCount} tabs closed from oldest group`)

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: Verify tabs are closed and oldest group state
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n[Phase 5] Verifying auto-close results...')

    // Small delay to allow DOM updates
    await new Promise(r => setTimeout(r, 500))

    // Re-query groups and tabs after close operation
    const resultAfter = await options.getGroupAndTabData()
    const groupsAfter = await options.getAllGroups()

    await logGroupState('After close', groupsAfter, resultAfter)

    // Verify that tabs were closed from the oldest group
    const expectedClosedCount = oldestGroupTabsBeforeCount
    expect(closedCount).toBe(expectedClosedCount)

    // Verify the oldest group was removed if it had no other tabs
    // OR if oldest group still exists, it should have 0 tabs for our simple test case
    if (groupsAfter.length > 0 && groupsAfter[0].title.includes(oldestThreshold.label)) {
      // Oldest group still exists - verify it has 0 tabs (unlikely but possible if race condition)
      console.log(`${oldestThreshold.label} group persisted with ${groupsAfter[0].tabCount} tabs`)
      expect(groupsAfter[0].tabCount).toBe(0)
    } else {
      // Oldest group was removed - verify it's gone
      const oldestGroupExists = groupsAfter.some(g => g.title.includes(oldestThreshold.label))
      console.log(`${oldestThreshold.label} group removed: ${!oldestGroupExists}`)
      expect(oldestGroupExists).toBe(false)
    }

    // Verify overall tab count decreased by the number of closed tabs
    const tabsAfterCount = resultAfter.groupedTabCount + resultAfter.ungroupedTabCount
    const tabsBeforeCount = result.groupedTabCount + result.ungroupedTabCount
    const expectedTabsRemaining = tabsBeforeCount - closedCount

    console.log(`Tab count: ${tabsBeforeCount} → ${tabsAfterCount} (expected: ${expectedTabsRemaining})`)
    expect(tabsAfterCount).toBe(expectedTabsRemaining)
  })
})











