import {expect, test} from '@playwright/test'
import {TestEnvironment} from "./chromium/extensions.js"

test.describe('24h Alarm: Auto-Close Feature', () => {
  let env: TestEnvironment

  test.beforeEach(async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()
    expect((await env.optionsPage.clickLoadMockTabs()).ok).toBe(true)
  })

  test.afterEach(async () => {
    if (env) await env.cleanup()
  })

  test.setTimeout(120_000)

  test('auto-close toggle enables/disables feature', async () => {
    //GIVEN
    await env.optionsPage.clickGroupTabs()
    const groupsBefore = await env.optionsPage.getAllGroups()
    expect(groupsBefore.length).toBe(5)

    //WHEN
    await env.optionsPage.clickAutoCloseToggle()
    
    //THEN
    expect(await env.optionsPage.isAutoCloseEnabled()).toBe(true)
    
    const groupsAfter = await env.optionsPage.getAllGroups()
    expect(groupsAfter.length).toBeGreaterThan(0)
  })
})

