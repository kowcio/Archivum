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

    // Load options page
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();

    // Close any existing tabs first (to have clean slate with only 1 tab = options page)
    await env.optionsPage.clickCloseAllTabs();

    // Click mock button
    const mockResult = await env.optionsPage.clickLoadMockTabs();
    expect(mockResult.ok).toBe(true);

    // Extra wait to ensure mock overrides are persisted to storage (WXT sync)
    // Group tabs
    await env.optionsPage.clickGroupTabs();

    // Get all tabs and groups
    const result = await env.optionsPage.getGroupAndTabData();

    // Verify: 5 groups created (one per active threshold level — default is 5)
    expect(result.groupCount).toBe(5);
    expect(result.groupsOrderedByIndex.length).toBe(5);

    // Verify: Each group has id and title (oldest → youngest, left → right)
    expect(result.groupsOrderedByIndex[0].title).toContain('Hell!');
    expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+');
    expect(result.groupsOrderedByIndex[2].title).toContain('Month+');
    expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+');
    expect(result.groupsOrderedByIndex[4].title).toContain('Week+');

    const backgroundRPC = env.optionsPage.getBackgroundRPC();
    const thresholds = (await backgroundRPC.storeGetThresholds().catch(() => null)) ?? { levels: [], activeLevels: 0 };
    const thresholdTitles = thresholds.levels?.slice(0, thresholds.activeLevels).map((l: { label: string; }) => l.label);

    for (let i = 0; i < result.groupsOrderedByIndex.length; i++) {
      expect(result.tabs[i].groupId).not.toBe(-1);
      expect(result.tabs[i].groupId).not.toBeUndefined();

      const groupTitle = result.groupsOrderedByIndex[i].title;
      const titleMatchesActiveGroup = thresholdTitles.some((label: string) => groupTitle.includes(label));
      expect(titleMatchesActiveGroup).toBe(true);
    }

    // Verify: Grouped tabs are first, ungrouped tabs at end
    const groupedTabs = result.tabs.filter((t) => t.groupId != null && t.groupId !== -1);
    const ungroupedTabs = result.tabs.filter((t) => !t.groupId || t.groupId === -1);

    expect(groupedTabs.length).toBe(14);
    expect(ungroupedTabs.length).toBeGreaterThanOrEqual(2); // at least options page + fresh tabs

  });
});

