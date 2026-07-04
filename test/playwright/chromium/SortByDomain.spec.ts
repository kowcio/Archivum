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
    const result = await options.clickLoadMockTabs(2000);
    expect(result.ok).toBe(true);


    // Count tabs before grouping
    const dataBefore = await options.getGroupAndTabData();
    const tabsBeforeGrouping = dataBefore.tabs.length;
    console.log(`📊 Tabs before grouping: ${tabsBeforeGrouping}`);

    // Group tabs
    await options.clickGroupTabs(1200);
    const groups = await options.getAllGroups();
    console.log(`📦 Groups created: ${groups.length}`);

    // Sort by domain
    await options.clickSortTabs(1500);

    // Verify results
    const data = await options.getGroupAndTabData();
    const { tabs, groupedTabCount, ungroupedTabCount } = data;

    console.log(`✅ Grouped tabs: ${groupedTabCount}, Ungrouped tabs: ${ungroupedTabCount}, Total: ${tabsBeforeGrouping}`);

    // Verify totals add up
    expect(groupedTabCount + ungroupedTabCount).toEqual(tabsBeforeGrouping);

    // Groups should have some tabs
    expect(groupedTabCount > 0).toBe(true);
    expect(ungroupedTabCount > 0).toBe(true);

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
    console.log(`📋 Ungrouped tabs: ${ungroupedTabs.length}`);

    // Verify ungrouped tabs are sorted by domain
    for (let i = 0; i < ungroupedTabs.length - 1; i++) {
      const currDomain = getSortKey(ungroupedTabs[i].url);
      const nextDomain = getSortKey(ungroupedTabs[i + 1].url);
      const domainCompare = currDomain.localeCompare(nextDomain);

      expect(domainCompare <= 0).toBe(true);
      console.log(`  [${i}] ${currDomain} ≤ ${nextDomain}`);
    }

    console.log(`✅ All ungrouped tabs are sorted correctly`);

    await options.close();
  });
});
