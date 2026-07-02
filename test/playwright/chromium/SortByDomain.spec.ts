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

    // Load mock tabs
    const result = await options.clickLoadMockTabs(2000);
    expect(result.ok).toBe(true);

    // Load 5 test domains
    const testDomains = [
      'https://zest.riddlehell.net/',
      'https://kowalskipiotr.pl',
      'https://bokehphotos.pl',
      'https://reddit.com',
      'https://alab.pl'
    ];
    for (const domain of testDomains) {
      const newPage = await ctx.context.newPage();
      await newPage.goto(domain, {waitUntil: 'domcontentloaded', timeout: 5000}).catch(() => {});
    }

    // Group tabs
    await options.clickGroupTabs(1200);
    const groups = await options.getAllGroups();
    expect(groups).toHaveLength(5);

    // Sort by domain
    await options.clickSortTabs(1500);

    // Verify results
    const data = await options.getGroupAndTabData();
    const { tabs, groupedTabCount, ungroupedTabCount } = data;

    // Groups should stay intact
    expect(groupedTabCount).toEqual(12);
    expect(ungroupedTabCount).toEqual(9);

    // Verify ungrouped tabs are sorted by domain then lastAccessed
    const getSortKey = (url?: string): string => {
      try {
        return new URL(url ?? '').hostname.replace(/^www\d?\./i, '');
      } catch {
        return '';
      }
    };

    const ungroupedTabs = tabs.filter(t => t.groupId == null || t.groupId === -1);
    for (let i = 0; i < ungroupedTabs.length - 1; i++) {
      const currDomain = getSortKey(ungroupedTabs[i].url);
      const nextDomain = getSortKey(ungroupedTabs[i + 1].url);
      const domainCompare = currDomain.localeCompare(nextDomain);

      expect(domainCompare).toBeLessThanOrEqual(0);

      // If same domain, check lastAccessed (newest first)
      if (domainCompare === 0) {
        expect(ungroupedTabs[i].lastAccessed).toBeGreaterThanOrEqual(ungroupedTabs[i + 1].lastAccessed || 0);
      }
    }

    await options.close();
  });
});
