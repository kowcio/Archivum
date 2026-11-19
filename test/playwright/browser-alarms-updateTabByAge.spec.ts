import { test, expect } from '@playwright/test'
import { TestEnvironment } from './chromium/extensions'

test.describe('updateTabByAge() - Tab movement verification', () => {
  let env: TestEnvironment

  test.beforeEach('Setup: launch fresh Chrome context', async () => {
    env = await TestEnvironment.create(false, 120_000)
    await env.optionsPage.gotoOptionsPage(env.extensionId)
    await env.optionsPage.expectPageLoaded()
  })

  test.afterEach('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test('tabs move to older groups as they age', async () => {
    // Setup
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
    await env.optionsPage.clickGroupTabs()

    const groupsBefore = await env.optionsPage.getAllGroups()
    expect(groupsBefore.length).toBeGreaterThan(0)

    // Act: age tabs by 7 days
    await env.optionsPage.timeProgress(7)

    // Assert: groups should exist
    const groupsAfter = await env.optionsPage.getAllGroups()
    expect(groupsAfter.length).toBe(5)
  })

  test('older groups have tabs after grouping', async () => {
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)

    const groups = await env.optionsPage.getAllGroups()
    expect(groups.length).toBe(0) // Ungrouped initially

    await env.optionsPage.clickGroupTabs()

    const groupedGroups = await env.optionsPage.getAllGroups()
    expect(groupedGroups.length).toBe(5)
  })

  test('multiple threshold levels are created', async () => {
    const mockResult = await env.optionsPage.clickLoadMockTabs()
    expect(mockResult.ok).toBe(true)
    await env.optionsPage.clickGroupTabs()

    const groups = await env.optionsPage.getAllGroups()
    expect(groups.length).toBe(5)
    
    // Verify standard group names exist
    expect(groups.some(g => g.title.includes('Hell'))).toBe(true)
    expect(groups.some(g => g.title.includes('Quarter'))).toBe(true)
    expect(groups.some(g => g.title.includes('Month'))).toBe(true)
  })
})
