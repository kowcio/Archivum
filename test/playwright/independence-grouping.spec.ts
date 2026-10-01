/**
 * groupTabsByAge E2E Test
 *
 * Verifies:
 * 1. Options page loads
 * 2. Mock tabs can be created
 * 3. Tabs are grouped by age (3 groups)
 * 4. Fresh tabs remain ungrouped
 */

import {test, expect} from '@playwright/test';
import {TestEnvironment} from "./chromium/extensions.js"

test.describe('groupTabsByAge E2E', () => {
  let env: TestEnvironment

  test.beforeAll('Setup', async () => {
    env = await TestEnvironment.create(false, 60_000);
  });

  test.afterAll('Cleanup', async () => {
    if (env) await env.cleanup();
  });

  test('Load options, click mock, group tabs, verify groups and ungrouped tabs', async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();

    const mockResult = await env.optionsPage.clickLoadMockTabs();
    expect(mockResult.ok).toBe(true);

    await env.optionsPage.clickGroupTabs();

    const result = await env.optionsPage.getGroupAndTabData();

    expect(result.groupCount).toBe(5);
    expect(result.groupsOrderedByIndex).toHaveLength(5);
    expect(result.groupsOrderedByIndex[0].title).toContain('Hell!');
    expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+');
    expect(result.groupsOrderedByIndex[2].title).toContain('Month+');
    expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+');
    expect(result.groupsOrderedByIndex[4].title).toContain('Week+');

    const groupedTabs = result.tabs.filter((t) => t.groupId != null && t.groupId !== -1);
    const ungroupedTabs = result.tabs.filter((t) => !t.groupId || t.groupId === -1);

    expect(groupedTabs.length).toBeGreaterThan(0);
    expect(ungroupedTabs.length).toBeGreaterThanOrEqual(1);
    expect(groupedTabs.length + ungroupedTabs.length).toBe(result.tabs.length);
    expect(result.tabs.length).toBeGreaterThanOrEqual(17);
  });
});

