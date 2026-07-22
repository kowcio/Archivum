/**
 * groupTabsByAge E2E Test
 *
 * Verifies:
 * 1. Options page loads
 * 2. Mock tabs can be created
 * 3. Tabs are grouped by age (3 groups)
 * 4. Fresh tabs remain ungrouped
 */

import { test, expect } from '@playwright/test';
import { setupExtensionTest, type ExtensionTestContext , WAIT_MS} from './chromium/extensions.js';
import { OptionsPage } from './page-objects/OptionsPage.js';

test.describe('groupTabsByAge E2E', () => {
  let ctx: ExtensionTestContext;

  test.beforeAll('Setup', async () => {
    ctx = await setupExtensionTest(false, 60_000);
  });

  test.afterAll('Cleanup', async () => {
    if (ctx) await ctx.cleanup();
  });

  test('Load options, click mock, group tabs, verify groups and ungrouped tabs', async () => {
    const options = new OptionsPage(await ctx.context.newPage());

    try {
      // Load options page
      await options.goto(ctx.extensionId);
      await options.expectPageLoaded();

      // Close any existing tabs first (to have clean slate with only 1 tab = options page)
      await options.clickCloseAllTabs();
      await options.page.waitForTimeout(WAIT_MS);

      // Click mock button
      const mockResult = await options.clickLoadMockTabs();
      expect(mockResult.ok).toBe(true);

      // Extra wait to ensure mock overrides are persisted to storage (WXT sync)
      await options.page.waitForTimeout(WAIT_MS);

      // Group tabs
      await options.clickGroupTabs(WAIT_MS);

      // Get all tabs and groups
      const result = await options.getGroupAndTabData();

      // Verify: 5 groups created (one per active threshold level — default is 5)
      expect(result.groupCount).toBe(5);
      expect(result.groupsOrderedByIndex.length).toBe(5);

        // Verify: Each group has id and title (oldest → youngest, left → right)
        expect(result.groupsOrderedByIndex[0].title).toContain('Hell!');
        expect(result.groupsOrderedByIndex[1].title).toContain('Quarter+');
        expect(result.groupsOrderedByIndex[2].title).toContain('Month+');
        expect(result.groupsOrderedByIndex[3].title).toContain('2 Weeks+');
        expect(result.groupsOrderedByIndex[4].title).toContain('Week+');

      // Verify each group has valid id and title
      for (let i = 0; i < result.groupsOrderedByIndex.length; i++) {
        expect(result.tabs[i].groupId).not.toBe(-1);
        expect(result.tabs[i].groupId).not.toBeUndefined();
      }

      // Verify: Grouped tabs are first, ungrouped tabs at end
      const groupedTabs = result.tabs.filter((t) => t.groupId != null && t.groupId !== -1);
      const ungroupedTabs = result.tabs.filter((t) => !t.groupId || t.groupId === -1);

      expect(groupedTabs.length).toBe(12);
      expect(ungroupedTabs.length).toBeGreaterThanOrEqual(2); // at least options page + fresh tabs

      // Verify that all grouped tabs have valid groupId
      for (const tab of groupedTabs) {
        expect(tab.groupId).not.toBe(-1);
        expect(tab.groupId).not.toBeUndefined();
      }

      console.log(
        `✅ PASSED: ${result.groupCount} groups (oldest→youngest left→right), ${ungroupedTabs.length} ungrouped tabs`
      );
    } finally {
      // Pages are auto-closed by Playwright
    }
  });
});

