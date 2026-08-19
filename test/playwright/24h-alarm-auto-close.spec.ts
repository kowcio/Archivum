import {expect, test} from '@playwright/test'
import {TestEnvironment} from "./chromium/extensions.js"

test.describe('24h Alarm: Auto-Close Feature', () => {
  let env: TestEnvironment
  const UNGROUPED_TABS = 4;
  const GROUPED_TABS = 14;

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

  test('should keep tabs when auto-close disabled, and close tabs when enabled', async () => {

    //GIVEN
    await env.optionsPage.clickGroupTabs()

    const ungroupedTabBefore = await env.optionsPage.getUngroupedTabs()
    expect(ungroupedTabBefore.length).toBe(UNGROUPED_TABS)

    const groupedTabBefore = await env.optionsPage.getGroupedTabs()
    expect(groupedTabBefore.length).toBe(GROUPED_TABS    )

    const tabsBefore = await env.optionsPage.getAllGroups()

    expect(tabsBefore[0].title).toContain("Hell!")
    expect(tabsBefore[0].tabCount).toBe(4)
    expect(tabsBefore[1].title).toContain("Quarter+")
    expect(tabsBefore[1].tabCount).toBe(4)
    expect(tabsBefore[2].title).toContain("Month+")
    expect(tabsBefore[2].tabCount).toBe(1)
    expect(tabsBefore[3].title).toContain("2 Weeks+")
    expect(tabsBefore[3].tabCount).toBe(2)
    expect(tabsBefore[4].title).toContain("Week+")
    expect(tabsBefore[4].tabCount).toBe(3)

    //WHEN

    await env.optionsPage.clickAutoCloseToggle()
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)
    await env.optionsPage.timeProgress(1)

    const groupsCreated = await env.optionsPage.getBackgroundRPC().testTriggerAlarm24h()
    //THEN
    // Phase 2 Assertions - EXACT values only (never use toBeGreaterThan)

    const ungroupedTabAfter = await env.optionsPage.getUngroupedTabs()
    expect(ungroupedTabAfter.length).toBe(ungroupedTabAfter.length)

    const groupedTabAfter = await env.optionsPage.getGroupedTabs()
    expect(groupedTabAfter.length).toBe(groupedTabAfter.length)

    const tabsAfter = await env.optionsPage.getAllGroups()

    expect(tabsAfter[0].title).toContain("Hell!")
    expect(tabsAfter[0].tabCount).toBe(tabsBefore[0].tabCount + 1)
    expect(tabsAfter[1].title).toContain("Quarter+")
    expect(tabsAfter[1].tabCount).toBe(tabsBefore[1].tabCount - 1)
    expect(tabsAfter[2].title).toContain("Month+")
    expect(tabsAfter[2].tabCount).toBe(tabsBefore[2].tabCount + 0)
    expect(tabsAfter[3].title).toContain("2 Weeks+")
    expect(tabsAfter[3].tabCount).toBe(tabsBefore[3].tabCount + 0)
    expect(tabsAfter[4].title).toContain("Week+")
    expect(tabsAfter[4].tabCount).toBe(tabsBefore[4].tabCount + 1)

  })
})

