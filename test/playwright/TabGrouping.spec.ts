/**
 * Tab Grouping E2E Test
 *
 * Verifies that when a user clicks on a grouped tab:
 * 1. The tab is ungrouped
 * 2. The tab is moved to the rightmost position (fresh)
 */

import { test, expect } from '@playwright/test'
import { launchChromeMv3Context } from './helpers/extensions.js'

test.describe('Tab Grouping - Activation Behavior', () => {
  test('clicking on grouped tab should ungroup and move to rightmost position', async () => {
    test.skip(test.info().project.name !== 'chrome-mv3', 'Run only in chrome-mv3 project')
    test.setTimeout(90000)

    const { context, extId } = await launchChromeMv3Context()
    console.log('🚀 Extension loaded with ID:', extId)

    // Create test tabs
    const page1 = await context.newPage()
    await page1.goto('https://example.com', { waitUntil: 'domcontentloaded' })

    const page2 = await context.newPage()
    await page2.goto('https://developer.mozilla.org', { waitUntil: 'domcontentloaded' })

    const page3 = await context.newPage()
    await page3.goto('https://github.com', { waitUntil: 'domcontentloaded' })

    console.log('📄 Created 3 test tabs')
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Open extension options page to get access to chrome.tabs API
    const extPage = await context.newPage()
    await extPage.goto(`chrome-extension://${extId}/options.html`, { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Test: Group tabs, then activate one and check if it moves
    const result = await extPage.evaluate(async () => {
      const logs: string[] = []

      try {
        // Get all tabs
        const allTabs = await chrome.tabs.query({ currentWindow: true })
        logs.push(`Found ${allTabs.length} tabs`)

        // Get tabs to group (skip first, usually extension pages)
        const tabsToGroup = allTabs
          .filter(t => t.id && t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')))
          .slice(0, 3)
          .map(t => t.id!)

        logs.push(`Tabs to group: ${tabsToGroup.join(', ')}`)

        if (tabsToGroup.length === 0) {
          logs.push('❌ No tabs to group')
          return { success: false, logs, groupId: -1 }
        }

        // Create a group
        const groupId = await chrome.tabs.group({ tabIds: tabsToGroup })
        logs.push(`✅ Created group#${groupId}`)

        // Update group properties
        await chrome.tabGroups.update(groupId, {
          title: 'Test Group',
          color: 'blue',
          collapsed: false
        })
        logs.push(`✅ Updated group#${groupId}`)

        // Get first tab's initial state
        const tabToActivate = tabsToGroup[0]
        const tabBefore = await chrome.tabs.get(tabToActivate)
        logs.push(`📊 Tab#${tabToActivate} BEFORE: groupId=${tabBefore.groupId}, index=${tabBefore.index}`)

        // Activate the tab - this should trigger background.ts listener
        await chrome.tabs.update(tabToActivate, { active: true })
        logs.push(`🖱️ Activated tab#${tabToActivate}`)

        // Wait for background listener to process
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Get tab's final state
        const tabAfter = await chrome.tabs.get(tabToActivate)
        const allTabsAfter = await chrome.tabs.query({ currentWindow: true })
        const maxIndex = Math.max(...allTabsAfter.map(t => t.index))

        logs.push(`📊 Tab#${tabToActivate} AFTER: groupId=${tabAfter.groupId}, index=${tabAfter.index}, maxIndex=${maxIndex}`)

        const wasUngrouped = tabAfter.groupId === -1
        const wasMovedToEnd = tabAfter.index === maxIndex

        logs.push(`✅ Ungrouped: ${wasUngrouped}, ✅ Moved to end: ${wasMovedToEnd}`)

        return {
          success: true,
          logs,
          groupId,
          tabId: tabToActivate,
          initialGroupId: tabBefore.groupId,
          initialIndex: tabBefore.index,
          finalGroupId: tabAfter.groupId,
          finalIndex: tabAfter.index,
          maxIndex,
          wasUngrouped,
          wasMovedToEnd
        }
      } catch (error) {
        logs.push(`❌ Error: ${error}`)
        return {
          success: false,
          logs,
          error: String(error)
        }
      }
    })

    await extPage.close()

    console.log('\n📊 Test result:', JSON.stringify(result, null, 2))
    console.log('\n📝 Logs:')
    result.logs?.forEach(log => console.log(`  ${log}`))

    // Assertions
    expect(result.success).toBe(true)
    if (result.wasUngrouped !== undefined) {
      expect(result.wasUngrouped).toBe(true)
      expect(result.wasMovedToEnd).toBe(true)
    }

    await context.close()
  })
})
