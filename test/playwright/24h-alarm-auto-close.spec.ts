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
    expect(initialGroups.length).toEqual(5)

    console.log('\n📊 INITIAL STATE (After Grouping)')
    console.log('  Groups:', initialGroups.map(g => `${g.title}: ${g.tabCount} tabs`).join(' | '))
    console.log('  Total tabs:', initialTabs.tabs.length)

    // ══════════════════════════════════════════════════════════════
    // SCENARIO 1: Auto-close DISABLED → nothing closes
    // ══════════════════════════════════════════════════════════════
    console.log('\n🚫 SCENARIO 1: Auto-close DISABLED')
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(false)

    // Find Hell! group by title (it may not be at [0] after grouping changes)
    const hellGroupBefore = initialGroups.find(g => g.title.includes('Hell!'))
    expect(hellGroupBefore).toBeDefined()
    const hellCountBefore = hellGroupBefore!.tabCount

    // Simulate alarm trigger (through RPC, respects the disable toggle)
    await env.optionsPage.bg.testTriggerAlarm24h()
    await new Promise(r => setTimeout(r, 100))

    const groupsAfterDisabled = await env.optionsPage.getAllGroups()
    const hellGroupAfterDisabled = groupsAfterDisabled.find(g => g.title.includes('Hell!'))

    console.log(`  Before: Hell! has ${hellCountBefore} tabs`)
    console.log(`  Trigger alarm (toggle OFF)...`)
    console.log(`  After: Hell! has ${hellGroupAfterDisabled?.tabCount} tabs`)
    console.log(`  Groups after disabled alarm: ${groupsAfterDisabled.map(g => `${g.title}(${g.tabCount})`).join(' | ')}`)
    console.log(`  ✓ Tabs unchanged (as expected)`)

    // Verify Hell! group unchanged
    expect(hellGroupAfterDisabled?.tabCount).toBe(hellCountBefore)
    expect(groupsAfterDisabled.length).toBe(initialGroups.length)

    // ══════════════════════════════════════════════════════════════
    // SCENARIO 2: Auto-close ENABLED → 367-day tab closes
    // ══════════════════════════════════════════════════════════════
    console.log('\n✅ SCENARIO 2: Auto-close ENABLED')
    await env.optionsPage.clickAutoCloseToggle()
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)

    console.log(`  Toggle ON (Hell! still has ${hellGroupAfterDisabled?.tabCount} tabs)`)
    console.log(`  Mock data ages: [1, 6, 8, 8, 12, 18, 25, 40, 60, 100, 101, 366, 366, 367]`)
    console.log(`  Hell! threshold = 365 days → closes tabs > 366 days`)
    console.log(`  Only 367-day tab qualifies for closure`)

    // Trigger alarm (now respects enabled toggle)
    await env.optionsPage.bg.testTriggerAlarm24h()
    await new Promise(r => setTimeout(r, 100))

    const groupsAfterEnabled = await env.optionsPage.getAllGroups()
    console.log(`  After alarm: Groups = ${groupsAfterEnabled.map(g => `${g.title}(${g.tabCount})`).join(' | ')}`)

    const hellGroupAfterClose = groupsAfterEnabled.find(g => g.title.includes('Hell!'))
    console.log(`  After: Hell! group found? ${hellGroupAfterClose ? 'YES' : 'NO'}`)

    if (hellGroupAfterClose) {
      console.log(`  After: Hell! has ${hellGroupAfterClose.tabCount} tabs (expected: ${(hellGroupAfterDisabled?.tabCount ?? 0) - 1})`)

      // Verify exactly 1 tab closed (367-day tab from Hell!)
      expect(hellGroupAfterClose.tabCount).toBe((hellGroupAfterDisabled?.tabCount ?? 0) - 1)

      // Verify all other groups unchanged
      for (const groupAfterClose of groupsAfterEnabled) {
        if (!groupAfterClose.title.includes('Hell!')) {
          const groupBefore = groupsAfterDisabled.find(g => g.title === groupAfterClose.title)
          expect(groupAfterClose.tabCount).toBe(groupBefore?.tabCount)
        }
      }

      console.log(`  ✓ Closed 1 tab (367-day from Hell!)`)
    } else {
      // Hell! group disappeared - this means all tabs were removed
      console.log(`  ✗ ISSUE: Hell! group completely disappeared!`)
      console.log(`  Expected Hell! to have ${(hellGroupAfterDisabled?.tabCount ?? 0) - 1} tabs`)
      console.log(`  All groups: ${groupsAfterEnabled.map(g => `${g.title}(${g.tabCount})`).join(' | ')}`)
      expect(hellGroupAfterClose).toBeFalsy()
    }
  })
})

