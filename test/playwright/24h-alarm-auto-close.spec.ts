import {expect, test} from '@playwright/test'
import {TestEnvironment} from "./chromium/extensions.js"
import {APP_DEFAULTS} from '../../src/constants.js'

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

  test('should keep tabs when auto-close disabled, and enable feature when toggled', async () => {
    // Setup: Group tabs
    await env.optionsPage.clickGroupTabs()
    const initialGroups = await env.optionsPage.getAllGroups()
    const initialTabs = await env.optionsPage.getGroupAndTabData()
    expect(initialGroups.length).toEqual(5)

    const oldestGroup = initialGroups[0]
    const initialTabCount = oldestGroup.tabCount

    // Scenario 1: Trigger alarm with auto-close disabled (default)
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(false)
    await env.optionsPage.bg.testTriggerAlarm24h()

    const groupsAfterAlarmDisabled = await env.optionsPage.getAllGroups()
    const tabsAfterAlarmDisabled = await env.optionsPage.getGroupAndTabData()
    const tabsCountForGroup = groupsAfterAlarmDisabled[4].tabCount;
    expect(tabsCountForGroup).toBe(initialTabCount)
    expect(tabsAfterAlarmDisabled.tabs.length).toBe(initialTabs.tabs.length)

    // Scenario 2: Enable auto-close and verify feature is active
    await env.optionsPage.clickAutoCloseToggle()
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)
    await env.optionsPage.bg.testTriggerAlarm24h()
    await new Promise(r => setTimeout(r, 100))
    const tabsAfterAutoCloser = await env.optionsPage.getAllGroups()

    //the Hell tabs should close
    expect(tabsAfterAutoCloser[0]).toBe(1)
    expect(tabsAfterAutoCloser[1]).toBe(2)
    expect(tabsAfterAutoCloser[2]).toBe(2)
    expect(tabsAfterAutoCloser[3]).toBe(2)
    expect(tabsAfterAutoCloser[4]).toBe(3)

  })
})

