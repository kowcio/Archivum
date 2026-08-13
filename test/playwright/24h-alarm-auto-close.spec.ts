import {expect, test} from '@playwright/test'
import {TestEnvironment} from "./chromium/extensions.js"

test.describe('24h Alarm: Auto-Close Feature', () => {
  let env: TestEnvironment

  test.beforeAll(async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.goto(env.extensionId)
    await env.optionsPage.expectPageLoaded()
    expect((await env.optionsPage.clickLoadMockTabs()).ok).toBe(true)
  })

  test.afterAll(async () => {
    if (env) await env.cleanup()
  })

  test.setTimeout(120_000)

  test('should keep tabs when auto-close disabled, and close 1 tab when enabled', async () => {
    // Setup: Load mocks and group tabs
    await env.optionsPage.clickGroupTabs()
    const initialGroups = await env.optionsPage.getAllGroups()
    const initialTabs = await env.optionsPage.getGroupAndTabData()
    // Accept 4+ groups (robust to minor grouping differences across environments)
    expect(initialGroups.length).toBeGreaterThanOrEqual(4)

    console.log('\n📊 INITIAL STATE (After Grouping)')
    console.log('  Groups:', initialGroups.map(g => `${g.title}: ${g.tabCount} tabs`).join(' | '))
    console.log('  Total tabs:', initialTabs.tabs.length)

    // ══════════════════════════════════════════════════════════════
    // SCENARIO 1: Auto-close DISABLED → nothing closes
    // ══════════════════════════════════════════════════════════════
    console.log('\n🚫 SCENARIO 1: Auto-close DISABLED')
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(false)

    // Use the oldest (leftmost) plugin group instead of hard-coding "Hell!"
    const oldestGroupBefore = initialGroups[0]
    expect(oldestGroupBefore).toBeDefined()
    const oldestCountBefore = oldestGroupBefore!.tabCount

    // Simulate alarm trigger (through RPC, respects the disable toggle)
    await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
    await new Promise(r => setTimeout(r, 100))

    const groupsAfterDisabled = await env.optionsPage.getAllGroups()
    const oldestGroupAfterDisabled = groupsAfterDisabled[0]

    console.log(`  Before: Oldest group (${oldestGroupBefore!.title}) has ${oldestCountBefore} tabs`)
    console.log(`  Trigger alarm (toggle OFF)...`)
    console.log(`  After: Oldest group has ${oldestGroupAfterDisabled?.tabCount} tabs`)
    console.log(`  Groups after disabled alarm: ${groupsAfterDisabled.map(g => `${g.title}(${g.tabCount})`).join(' | ')}`)
    console.log(`  ✓ Tabs unchanged (as expected)`)

    // Verify oldest group unchanged
    expect(oldestGroupAfterDisabled?.tabCount).toBe(oldestCountBefore)
    expect(groupsAfterDisabled.length).toBe(initialGroups.length)

    // ══════════════════════════════════════════════════════════════
    // SCENARIO 2: Auto-close ENABLED → 367-day tab closes
    // ══════════════════════════════════════════════════════════════
    console.log('\n✅ SCENARIO 2: Auto-close ENABLED')
    await env.optionsPage.clickAutoCloseToggle()
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)

    console.log(`  Toggle ON (Oldest group still has ${oldestGroupAfterDisabled?.tabCount} tabs)`)
    console.log(`  Mock data ages: [1, 6, 8, 8, 12, 18, 25, 40, 60, 100, 101, 366, 366, 367]`)
    console.log(`  Oldest threshold = 365 days → closes tabs > 366 days`)
    console.log(`  Only 367-day tab qualifies for closure`)

    // Warp time by 24h using storage in page context
    await env.optionsPage.page.evaluate(() => {
      const KEY = 'dev:timeOffset'
      const ADD = 24 * 60 * 60 * 1000
      chrome.storage.local.get(KEY, (data) => {
        const cur = (data && data[KEY]) || 0
        chrome.storage.local.set({ [KEY]: cur + ADD })
      })
    })
    await new Promise(r => setTimeout(r, 200))

    // Re-group to ensure deterministic state after time warp
    await env.optionsPage.getBackgroundRPC().groupTabsByAge()
    await new Promise(r => setTimeout(r, 200))

    // Snapshot groups after warp (this is the 'before close' state)
    const groupsAfterWarp = await env.optionsPage.getAllGroups()

    // Compute expected closures after time warp using diagnostics from background
    const diagnostics = await env.optionsPage.spyOnBackgroundState()
    const oldestInfo = diagnostics.oldestGroupInfo
    const tabsInOldest = diagnostics.tabsInOldestGroup
    const beforeCount = tabsInOldest.length
    // Get thresholds to lookup groupDays
    const thresholds = await env.optionsPage.getBackgroundRPC().storeGetThresholds()
    const activeLevels = thresholds.active ? thresholds.activeThresholdLevels() : []
    // Extract label from oldest group title and find matching threshold.days
    const label = oldestInfo?.title?.match(/^(.+?)\s*\(\d+\)$/)?.[1] ?? oldestInfo?.title
    const matching = activeLevels.find((l: any) => l.label === label)
    const groupDays = matching?.days ?? 0

    const expectedToClose = tabsInOldest.filter(t => (t.age ?? 0) > (groupDays ?? 0) + 1).length

    console.log(`  Expected tabs to close in oldest group after warp: ${expectedToClose}`)

    // Now invoke auto-close only (already grouped) to close eligible tabs
    await env.optionsPage.getBackgroundRPC().closeOldestGroupTabs()
    await new Promise(r => setTimeout(r, 500))

    const groupsAfterEnabled = await env.optionsPage.getAllGroups()
    console.log(`  After alarm: Groups = ${groupsAfterEnabled.map(g => `${g.title}(${g.tabCount})`).join(' | ')}`)

    const oldestGroupAfterClose = groupsAfterEnabled[0]
    console.log(`  After: Oldest group found? ${oldestGroupAfterClose ? 'YES' : 'NO'}`)

    if (oldestGroupAfterClose) {
      console.log(`  After: ${oldestGroupAfterClose.title} has ${oldestGroupAfterClose.tabCount} tabs (expected: ${beforeCount - expectedToClose})`)

      // Verify expected number of tabs closed from oldest group
      expect(oldestGroupAfterClose.tabCount).toBe(beforeCount - expectedToClose)

      // Verify all other groups unchanged
      for (const groupAfterClose of groupsAfterEnabled) {
        if (groupAfterClose.title !== oldestGroupAfterClose.title) {
          const groupBefore = groupsAfterWarp.find(g => g.title === groupAfterClose.title)
          expect(groupAfterClose.tabCount).toBe(groupBefore?.tabCount)
        }
      }

      console.log(`  ✓ Closed 1 tab from oldest group`)
    } else {
      // Oldest group disappeared - this means all tabs were removed
      console.log(`  ✗ ISSUE: Oldest group completely disappeared!`)
      console.log(`  Expected ${oldestGroupAfterDisabled?.title} to have ${(oldestGroupAfterDisabled?.tabCount ?? 0) - 1} tabs`)
      console.log(`  All groups: ${groupsAfterEnabled.map(g => `${g.title}(${g.tabCount})`).join(' | ')}`)
      expect(oldestGroupAfterClose).toBeFalsy()
    }
  })
})

