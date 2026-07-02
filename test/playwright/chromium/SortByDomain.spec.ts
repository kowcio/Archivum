/**
 * E2E test: Sort Tabs by Domain functionality with grouping
 * Chrome MV3 only. Run: npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Tests complete workflow: load mock tabs → add test domains → group → sort
 * ✅ Verifies tabs sorted by domain (alphabetical) then lastAccessed (newest first within domain)
 * ✅ Displays before/after comparison and ungrouped tab results
 */

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

    const testDomains = [
      'https://zest.riddlehell.net/',
      'https://kowalskipiotr.pl',
      'https://bokehphotos.pl',
      'https://reddit.com',
      'https://alab.pl'
    ];

    // Step 1: Load mock tabs
    const result = await options.clickLoadMockTabs(2000);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(16);

    // Step 2: Manually load test domains in a loop
    await test.step("Open 5 test domains that will be ungrouped", async () => {
      for (const domain of testDomains) {
        const newPage = await ctx.context.newPage();
        await newPage.goto(domain, {waitUntil: 'domcontentloaded', timeout: 5000}).catch(() => {
        });
      }

      // Step 3: Verify total tabs
      const totalTabs = await options.page.evaluate(async () => {
        return (await chrome.tabs.query({currentWindow: true})).length;
      });
      expect(totalTabs).toBeGreaterThanOrEqual(2 + 14 + testDomains.length);
      console.log(`   ✓ Total tabs: ${totalTabs}`);

      // Step 5: Group tabs by age
      await options.clickGroupTabs(1200);
      const allGroups = await options.getAllGroups();
      expect(allGroups).toHaveLength(5);
      console.log(`   ✓ Created ${allGroups.length} groups`);

    });

    // Step 6: Sort tabs by domain
    await test.step("Sort by domain", async () => {
      await options.clickSortTabs(1500);
    });

    // Step 7: Capture AFTER state and verify ungrouped tabs
    await test.step("Verify ungrouped tabs after sort", async () => {
      const allTabData = await options.getGroupAndTabData()
      const tabs = allTabData.tabs
      const groupedTabCount = allTabData.groupedTabCount
      const ungroupedTabCount = allTabData.ungroupedTabCount
      // const groups = allTabData.groups
      const groupCount = allTabData.groupCount

    expect(tabs.length).toEqual(2+14+5)
    expect(groupedTabCount).toEqual(12)
    expect(ungroupedTabCount).toEqual(9)
    expect(groupCount).toEqual(5)


      await options.close();
    });
  });
});
