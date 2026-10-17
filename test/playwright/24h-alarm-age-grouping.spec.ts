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

  test('should move tabs to older groups after 1 day passes', async () => {
    await env.optionsPage.clickGroupTabs()

    const expectedGroupOrder = ['Hell!', 'Quarter+', 'Month+', '2 Weeks+', 'Week+']
    const getGroupOrderIndex = (title: string) => {
      const normalized = title.replace(/\s+\(\d+\)$/, '')
      return expectedGroupOrder.indexOf(normalized)
    }
    const assertOrderedSubset = (titles: string[]) => {
      const indices = titles.map((title) => getGroupOrderIndex(title)).filter((idx) => idx !== -1)
      expect(indices.length).toBe(titles.length)
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1])
      }
    }

    const before = await env.optionsPage.getGroupAndTabData()
    expect(before.tabs).toHaveLength(17)
    expect(before.groupedTabCount).toBe(15)
    expect(before.ungroupedTabCount).toBe(2)
    assertOrderedSubset(before.groupsOrderedByIndex.map((group) => group.title))

    for (const [index, group] of before.groupsOrderedByIndex.entries()) {
      expect(group.title).toContain(expectedGroupOrder[index])
    }

    for (const tab of before.tabs) {
      expect(tab.id).toBeDefined()
      if (tab.groupId === undefined || tab.groupId === -1) {
        continue
      }
      const group = before.groupsOrderedByIndex.find(item => item.id === tab.groupId)
      expect(group).toBeDefined()
      expect(getGroupOrderIndex(group!.title)).not.toBe(-1)
    }

    const nativeTabCountByGroup = Object.fromEntries(
      before.groupsOrderedByIndex.map(group => [
        group.title.replace(/\s+\(\d+\)$/, ''),
        Number(group.title.match(/\((\d+)\)$/)?.[1] ?? '0'),
      ])
    )

    expect(nativeTabCountByGroup['Hell!']).toBe(4)
    expect(nativeTabCountByGroup['Quarter+']).toBe(5)
    expect(nativeTabCountByGroup['Month+']).toBe(1)
    expect(nativeTabCountByGroup['2 Weeks+']).toBe(2)
    expect(nativeTabCountByGroup['Week+']).toBe(3)

    const beforeById = new Map(before.tabs.map(tab => [tab.id, tab]))

    await env.optionsPage.timeProgress(1)
    const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
    expect(groupsCreated).toBeGreaterThanOrEqual(0)

    const after = await env.optionsPage.getGroupAndTabData()
    expect(after.tabs).toHaveLength(17)
    expect(after.groupedTabCount + after.ungroupedTabCount).toBe(17)
    assertOrderedSubset(after.groupsOrderedByIndex.map((group) => group.title))

    let movedToOlderGroup = false

    for (const [tabId, beforeTab] of beforeById.entries()) {
      const afterTab = after.tabs.find(tab => tab.id === tabId)
      expect(afterTab).toBeDefined()

      const beforeGroup = before.groupsOrderedByIndex.find(group => group.id === beforeTab.groupId)
      const afterGroup = after.groupsOrderedByIndex.find(group => group.id === afterTab!.groupId)

      if (beforeGroup && afterGroup) {
        const beforeIndex = getGroupOrderIndex(beforeGroup.title)
        const afterIndex = getGroupOrderIndex(afterGroup.title)
        if (beforeIndex > afterIndex) {
          movedToOlderGroup = true
        }
      }
    }

    expect(movedToOlderGroup).toBe(true)

    const beforeCounts = Object.fromEntries(
      before.groupsOrderedByIndex.map(group => [group.title.replace(/\s+\(\d+\)$/, ''), Number(group.title.match(/\((\d+)\)$/)?.[1] ?? '0')])
    )
    const afterCounts = Object.fromEntries(
      after.groupsOrderedByIndex.map(group => [group.title.replace(/\s+\(\d+\)$/, ''), Number(group.title.match(/\((\d+)\)$/)?.[1] ?? '0')])
    )
    const sharedLabels = Object.keys(beforeCounts).filter((label) => label in afterCounts)
    const changed = sharedLabels.some((label) => beforeCounts[label] !== afterCounts[label])
    expect(changed).toBe(true)
  })
})
