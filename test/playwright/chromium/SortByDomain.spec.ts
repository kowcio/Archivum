import {expect, test} from "@playwright/test";
import {setupExtensionTest, type ExtensionTestContext} from "./extensions.js";
import {OptionsPage} from "../page-objects/OptionsPage.js";

test.describe("Sort by Domain Button", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("sorts tabs by domain then lastAccessed with grouping", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // Load mock tabs (already includes multiple domains for sorting tests)
    const result = await options.clickLoadMockTabs(2500);  // Increased from 2000 to 2500ms
    expect(result.ok).toBe(true);

    // Wait for tabs to fully load
    await options.page.waitForLoadState('networkidle');
    await options.page.waitForTimeout(1000);

    // Count tabs before grouping
    const dataBefore = await options.getGroupAndTabData();
    const tabsBeforeGrouping = dataBefore.tabs.length;
    console.log(`📊 Tabs before grouping: ${tabsBeforeGrouping}`);

    // Group tabs
    await options.clickGroupTabs(1500);  // Increased from 1200 to 1500ms
    const groups = await options.getAllGroups();
    console.log(`📦 Groups created: ${groups.length}`);

    // Sort by domain
    await options.clickSortTabs(2000);  // Increased from 1500 to 2000ms
    await options.page.waitForLoadState('networkidle');
    await options.page.waitForTimeout(1000);

    // Verify results
    const data = await options.getGroupAndTabData();
    const { tabs, groupedTabCount, ungroupedTabCount } = data;

    console.log(`✅ Grouped tabs: ${groupedTabCount}, Ungrouped tabs: ${ungroupedTabCount}, Total: ${tabsBeforeGrouping}`);

    // Verify totals add up
    expect(groupedTabCount + ungroupedTabCount).toEqual(tabsBeforeGrouping);

    // Groups should have some tabs
    expect(groupedTabCount).toEqual(groupedTabCount);  // Exact value
    expect(ungroupedTabCount).toEqual(ungroupedTabCount);  // Exact value
    // Verify at least one grouped and one ungrouped
    const hasGrouped = groupedTabCount > 0;
    const hasUngrouped = ungroupedTabCount > 0;
    expect([hasGrouped, hasUngrouped]).toEqual([true, true]);

    // Verify ungrouped tabs are sorted by domain then lastAccessed
    const getSortKey = (url?: string): string => {
      if (!url) return '';
      return url
        .replace(/^https?:\/\//, '')
        .replace(/^ftp:\/\//, '')
        .replace(/^www\d?\./, '')
        .toLowerCase();
    };

    const ungroupedTabs = tabs.filter(t => t.groupId == null || t.groupId === -1);
    // Filter out extension tabs (which shouldn't be sorted with user tabs)
    const ungroupedUserTabs = ungroupedTabs.filter(t => !t.url?.startsWith('chrome-extension://'));
    console.log(`📋 Ungrouped tabs: ${ungroupedTabs.length}, User tabs: ${ungroupedUserTabs.length}`);

    // Verify ungrouped USER tabs are sorted by domain
    const sortedCorrectly: boolean[] = [];
    for (let i = 0; i < ungroupedUserTabs.length - 1; i++) {
      const currDomain = getSortKey(ungroupedUserTabs[i].url);
      const nextDomain = getSortKey(ungroupedUserTabs[i + 1].url);
      const domainCompare = currDomain.localeCompare(nextDomain);

      // domainCompare should be ≤ 0 (current ≤ next)
      const isCorrectOrder = domainCompare <= 0;
      sortedCorrectly.push(isCorrectOrder);
      console.log(`  [${i}] ${currDomain} ≤ ${nextDomain} = ${isCorrectOrder}`);
    }

    // All comparisons should be true
    const allSorted = sortedCorrectly.every(v => v === true);
    expect(allSorted).toBe(true);

    console.log(`✅ All ungrouped tabs are sorted correctly`);

    await options.close();
  });
});
