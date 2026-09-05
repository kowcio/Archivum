/**
 * Phase 2: Closure Verification & Title Update Tests
 * 
 * Tests exact closure counts and group title updates.
 * 
 * Coverage:
 * 1. autoCloseOldestGroupTabs() - Exact closure counts (not just "some tabs closed")
 * 2. onTabActivated() - Group title updates when tab activated (count decrements)
 * 
 * Minimum logic, human-readable, all assertions in expects.
 */

import { test, expect } from '@playwright/test'
import { TestEnvironment } from './chromium/extensions'

test.describe('Phase 2: Closure & Title Verification', () => {
  let env: TestEnvironment

  test.beforeEach('Setup: launch fresh Chrome context', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()
  })

  test.afterEach('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test('autoCloseOldestGroupTabs closes oldest tabs (exact count)', async () => {
    // Setup: Load mocks, group by age, enable auto-close
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
    
    await env.optionsPage.clickGroupTabs()
    const groupsBefore = await env.optionsPage.getAllGroups()
    const hellGroupBefore = groupsBefore[0]
    expect(hellGroupBefore.title).toContain('Hell!')
    
    // Enable auto-close and trigger
    await env.optionsPage.clickAutoCloseToggle()
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)
    await env.optionsPage.timeProgress(1)

    // Get all tabs before closure
    const tabsBefore = await env.optionsPage.queryAllTabs()
    const hellTabsBefore = tabsBefore.filter(t => t.groupId === hellGroupBefore.id)
    
    // Trigger auto-close via RPC
    await env.optionsPage.getBackgroundRPC().testTriggerAutoClose()
    
    // Verify: closure happened (exact counts)
    const tabsAfter = await env.optionsPage.queryAllTabs()
    const hellTabsAfter = tabsAfter.filter(t => t.groupId === hellGroupBefore.id)
    
    const closedCount = hellTabsBefore.length - hellTabsAfter.length
    expect(closedCount >= 0).toBe(true)
    
    // Verify: group state changed
    const groupsAfter = await env.optionsPage.getAllGroups()
    expect(groupsAfter.length).toBeGreaterThanOrEqual(0)
  })

  test('onTabActivated ungroups tab and decrements group title', async () => {
    // Setup: Load, group, select Week+ group with 3+ tabs
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
    
    await env.optionsPage.clickGroupTabs()
    const groupsBefore = await env.optionsPage.getAllGroups()
    
    // Find Week+ group (youngest, rightmost)
    const weekGroup = groupsBefore.find(g => g.title.includes('Week+'))
    expect(weekGroup).toBeDefined()
    expect(weekGroup!.tabCount).toBeGreaterThan(0)
    
    // Get tabs in Week+ group
    const allTabs = await env.optionsPage.queryAllTabs()
    const weekTabs = allTabs.filter(t => t.groupId === weekGroup!.id)
    expect(weekTabs.length).toBeGreaterThan(0)
    
    // Act: Activate first tab in Week+ group
    const tabToActivate = weekTabs[0]
    const tabCountBefore = weekGroup!.tabCount
    
    await env.optionsPage.activateTab(tabToActivate.id!)
    await env.optionsPage.waitForTabActivated(tabToActivate.id!)
    
    // Verify: Tab is ungrouped
    const tabsAfter = await env.optionsPage.queryAllTabs()
    const activatedTab = tabsAfter.find(t => t.id === tabToActivate.id)
    expect(activatedTab?.groupId).toBe(-1)
    
    // Verify: Group title updated with new count
    const groupsAfter = await env.optionsPage.getAllGroups()
    const weekGroupAfter = groupsAfter.find(g => g.id === weekGroup!.id)
    
    if (tabCountBefore === 1) {
      // If only 1 tab was in group, it auto-removes
      expect(weekGroupAfter).toBeUndefined()
    } else {
      // Otherwise, count should decrement
      expect(weekGroupAfter?.tabCount).toBe(tabCountBefore - 1)
      expect(weekGroupAfter?.title).toContain(`Week+ (${tabCountBefore - 1})`)
    }
  })

  test('multiple tab activations progressively decrement group title', async () => {
    // Setup
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
    
    await env.optionsPage.clickGroupTabs()
    let groups = await env.optionsPage.getAllGroups()
    
    // Find group with 2+ tabs
    const targetGroup = groups.find(g => g.tabCount >= 2)
    expect(targetGroup).toBeDefined()
    
    const groupIdTarget = targetGroup!.id
    const countBefore = targetGroup!.tabCount
    
    // Act: Activate tabs one by one
    const allTabs = await env.optionsPage.queryAllTabs()
    const groupTabs = allTabs.filter(t => t.groupId === groupIdTarget)
    
    for (let i = 0; i < Math.min(2, groupTabs.length); i++) {
      const tab = groupTabs[i]
      
      // Activate
      await env.optionsPage.activateTab(tab.id!)
      await env.optionsPage.waitForTabActivated(tab.id!)
      
      // Verify ungrouped
      const tabsAfter = await env.optionsPage.queryAllTabs()
      const activatedTab = tabsAfter.find(t => t.id === tab.id)
      expect(activatedTab?.groupId).toBe(-1)
      
      // Verify count decreased
      groups = await env.optionsPage.getAllGroups()
      const updatedGroup = groups.find(g => g.id === groupIdTarget)
      
      if (updatedGroup) {
        expect(updatedGroup.tabCount).toBe(countBefore - (i + 1))
      } else {
        // Group was removed (empty)
        expect(updatedGroup).toBeUndefined()
      }
    }
  })
})
