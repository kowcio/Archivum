/**
 * onTabActivated E2E Test
 *
 * Verifies: When last tab is activated from a group, groupId is set to -1 and group disappears.
 *
 * IMPORTANT FIX (see ../FIX_TAB_UNGROUPING.md):
 * The service worker uses browser.tabs.ungroup([tabId]) to remove tabs from groups.
 * DO NOT use browser.tabs.update(id, { groupId: -1 }) — it silently does nothing.
 * The ungroup() API is the only way to actually remove a tab from its group (Chrome/Edge).
 */

import { test, expect } from '@playwright/test'
import { setupExtensionTest, type ExtensionTestContext } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

test.describe('onTabActivated — last tab removes group', () => {
  let ctx: ExtensionTestContext

  test.beforeAll('Setup', async () => {
    ctx = await setupExtensionTest(false, 60_000)
  })

  test.afterAll('Cleanup', async () => {
    if (ctx) await ctx.cleanup()
  })

  test('Last tab from group: activating it sets groupId=-1 and group disappears', async () => {
    const options = new OptionsPage(await ctx.context.newPage())

    try {
      await options.goto(ctx.extensionId)
      await options.expectPageLoaded()
      await options.clickCloseAllTabs()
      await options.page.waitForTimeout(500)

      // Create 1 tab and group it with plugin-style title
      const tab = await options.page.evaluate(async () => {
        return await new Promise<{ id: number }>((resolve) => {
          chrome.tabs.create({ url: 'https://example.com', active: false }, (t: any) => {
            resolve({ id: t.id })
          })
        })
      })
      await options.page.waitForTimeout(500)

      // Create group with plugin-style title so isInPluginGroup() recognizes it
      const groupId = await options.page.evaluate(async (tabId: number) => {
        return await new Promise<number>((resolve) => {
          (chrome.tabs as any).group({ tabIds: [tabId] }, (id: number) => resolve(id))
        })
      }, tab.id)

      // Use plugin-style title so onTabActivated recognizes it
      await options.page.evaluate((id: number) => {
        return (chrome.tabGroups as any).update(id, { title: 'Week+ (1)', collapsed: true })
      }, groupId)

      await options.page.waitForTimeout(500)

       // Verify: Group exists before activation
       const before = await options.getGroupAndTabData()
       expect(before.groupCount).toBe(1)
       expect(before.groupsOrderedByIndex[0].id).toBe(groupId)

      // Activate the only tab in the group
      await options.activateTab(tab.id)

      // Use Playwright's native polling + expect pattern to wait for service worker
      // This is idiomatic Playwright that handles retries + backoff automatically
      await expect.poll(
        async () => {
          const data = await options.getGroupAndTabData()
          const activatedTab = data.tabs.find(t => t.id === tab.id)
          return activatedTab?.groupId ?? null
        },
        {
          message: 'service worker should ungroup the activated tab',
          timeout: 15000,  // 5 second timeout (covers slow CI)
        }
      ).toBe(-1)

      // Verify final state: Tab ungrouped and group is gone
      const after = await options.getGroupAndTabData()
      const activatedTab = after.tabs.find(t => t.id === tab.id)
      expect(activatedTab?.groupId).toBe(-1)
      expect(after.groupCount).toBe(0)

    } finally {
      // Pages are auto-closed by Playwright
    }
  })
})
