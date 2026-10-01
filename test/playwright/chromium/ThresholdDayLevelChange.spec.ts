/**
 * E2E test: Change threshold day level and verify group tab counts change.
 *
 * Verifies that when Week+ threshold changes from 7→3 days:
 * - More tabs become "Week+" (shifted from fresh)
 * - Tab counts per group reflect the new classification
 * - All groups are created correctly after Apply
 */
import {test, expect} from '@playwright/test'
import {TestEnvironment} from "./extensions.js"
import {ThresholdLabel} from "../../../src/constants.js";

test.describe('Threshold Day Levels', () => {
  let env: TestEnvironment

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    env = await TestEnvironment.create(false, 90_000)
  })

  test.afterAll('Cleanup: close extension context', async () => {
    if (env) await env.cleanup()
  })

  test('Check threshold day levels to save properly and change tabs after apply', async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId)

    const resp = await env.optionsPage.clickLoadMockTabs()
    expect(resp.ok).toBe(true)

    await env.optionsPage.clickGroupTabs()
    let groups = await env.optionsPage.getAllGroups()

    expect(groups).toHaveLength(5)
    expect(groups[0].title).toContain(ThresholdLabel.YEARS)
    expect(groups[1].title).toContain(ThresholdLabel.QUARTERS)
    expect(groups[2].title).toContain(ThresholdLabel.MONTH)
    expect(groups[3].title).toContain(ThresholdLabel.WEEKS_2)
    expect(groups[4].title).toContain(ThresholdLabel.WEEK)
    groups.forEach(group => expect(group.tabCount).toBeGreaterThan(0))

    const beforeCounts = groups.map(group => group.tabCount)

    await env.optionsPage.changeThresholdDayValue(0, 3)
    await env.optionsPage.clickGroupTabs()

    groups = await env.optionsPage.getAllGroups()
    expect(groups).toHaveLength(5)
    expect(groups[0].title).toContain(ThresholdLabel.YEARS)
    expect(groups[1].title).toContain(ThresholdLabel.QUARTERS)
    expect(groups[2].title).toContain(ThresholdLabel.MONTH)
    expect(groups[3].title).toContain(ThresholdLabel.WEEKS_2)
    expect(groups[4].title).toContain(ThresholdLabel.WEEK)
    groups.forEach(group => expect(group.tabCount).toBeGreaterThan(0))

    const afterCounts = groups.map(group => group.tabCount)
    expect(afterCounts).not.toEqual(beforeCounts)

    const ungroupedCount = await env.optionsPage.getUngroupedTabCount()
    expect(ungroupedCount).toBeGreaterThanOrEqual(1)

    await env.optionsPage.close()
  })
})
