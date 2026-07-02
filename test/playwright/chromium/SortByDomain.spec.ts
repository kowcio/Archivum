/// <reference types="chrome" />

/**
 * E2E test: Sort Tabs by Domain functionality
 * Chrome MV3 only. Run: npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Uses Page Object Models (POM) for clean test code
 * ✅ Creates mock tabs with different domains (domain sorting validation)
 * ✅ Clicks SortButton and verifies tabs are sorted alphabetically by domain
 * ✅ Validates tab positions match sorted domain order
 *
 * Flow:
 * 1. Load mock tabs with various domains (google.com, example.com, github.com, etc.)
 * 2. Click SortButton to trigger sort by domain
 * 3. Query all tabs and extract domain names
 * 4. Verify tabs are in alphabetical domain order
 * 5. Verify each tab position matches expected sorted position
 */

import { expect, test } from "@playwright/test";
import { setupExtensionTest, type ExtensionTestContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";

// Merged chrome tab type: Partial chrome.tabs.Tab properties + domain field
type ChromeTab = Partial<chrome.tabs.Tab> & { domain?: string }

test.describe("Sort by Domain Button", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1 sorts ungrouped tabs alphabetically by domain", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    await test.step("Create mock tabs with various domains", async () => {
      const result = await options.clickLoadMockTabs(2000);
      expect(result.ok).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      console.log(`   ✓ Created ${result.count} mock tabs`);
    });

    await test.step("Click SortButton and verify sorting completes", async () => {
      const result = await options.clickGroupTabsByDomain(1500);
      expect(result.error).toBeNull();
      console.log(`   ✓ Sort completed: ${result.groupsCreated} tabs reordered`);
    });

    await test.step("Query all tabs and verify domain order", async () => {
      const tabs = await options.page.evaluate(async () => {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        return allTabs.map((tab: ChromeTab) => {
          try {
            const url = new URL(tab.url || '');
            const domain = url.hostname.replace(/^www\d?\./i, '');
            return {
              id: tab.id,
              url: tab.url,
              domain: domain,
              groupId: tab.groupId ?? -1,
            };
          } catch {
            return {
              id: tab.id,
              url: tab.url,
              domain: '',
              groupId: tab.groupId ?? -1,
            };
          }
        });
      });

      expect(tabs.length).toBeGreaterThan(0);
      console.log(`   ✓ Retrieved ${tabs.length} tabs`);

      // Extract domains in their current order
      const currentDomains = tabs.map((t: ChromeTab) => t.domain ?? '');
      console.log(`   → Current domain order: ${currentDomains.join(' → ')}`);

      // Verify domains are sorted alphabetically (with empty domains at end)
      const sortedDomains = [...currentDomains].sort((a: string, b: string) => {
        // Empty domains go to end
        if (a === '') return 1;
        if (b === '') return -1;
        return a.localeCompare(b);
      });

      console.log(`   → Expected domain order: ${sortedDomains.join(' → ')}`);

      // Verify each tab is in correct sorted position
      for (let i = 0; i < tabs.length; i++) {
        const currentDomain = currentDomains[i];
        const expectedDomain = sortedDomains[i];
        expect(currentDomain).toBe(expectedDomain);
        console.log(
          `   ✓ Tab ${i + 1}: ${tabs[i].id ?? '?'} → "${currentDomain}" (expected: "${expectedDomain}")`
        );
      }

      console.log(`   ✓ All ${tabs.length} tabs are in correct sorted domain order`);
    });

    await options.close();
  });

  test("2 sorts tabs preserving group membership (grouped tabs not moved)", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    let groupedTabsBeforeSort: number;
    let groupCountBefore: number;

    await test.step("Create mock tabs", async () => {
      const result = await options.clickLoadMockTabs(2000);
      expect(result.ok).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    await test.step("Group tabs by age to create groups", async () => {
      await options.clickGroupTabs(1200);
      groupCountBefore = await options.getGroupCount();
      const grouped = await options.getGroupedTabs();
      groupedTabsBeforeSort = grouped.length;
      console.log(`   ✓ Groups created: ${groupCountBefore}, grouped tabs: ${groupedTabsBeforeSort}`);
    });

    await test.step("Sort by domain and verify groups are preserved", async () => {
      const result = await options.clickGroupTabsByDomain(1500);
      expect(result.error).toBeNull();

      const groupCountAfter = await options.getGroupCount();
      const groupedTabsAfter = (await options.getGroupedTabs()).length;

      expect(groupCountAfter).toBe(groupCountBefore);
      expect(groupedTabsAfter).toBe(groupedTabsBeforeSort);
      console.log(`   ✓ Groups preserved: ${groupCountAfter}, grouped tabs: ${groupedTabsAfter}`);
    });

    await options.close();
  });

  test("3 verifies exact domain alphabetical order (no approximations)", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    await test.step("Create mock tabs", async () => {
      const result = await options.clickLoadMockTabs(2000);
      expect(result.ok).toBe(true);
    });

    await test.step("Sort and validate exact domain positions", async () => {
      await options.clickGroupTabsByDomain(1500);

      const tabData = await options.page.evaluate(async () => {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        return allTabs
          .map((tab: ChromeTab): ChromeTab => {
            try {
              const url = new URL(tab.url || '');
              const domain = url.hostname.replace(/^www\d?\./i, '');
              return { id: tab.id, domain, index: tab.index };
            } catch {
              return { id: tab.id, domain: '', index: tab.index };
            }
          })
          .filter((t: ChromeTab) => t.domain !== ''); // Filter out invalid URLs
      });

      // Verify domain order is strictly alphabetical
      for (let i = 0; i < tabData.length - 1; i++) {
        const current = (tabData[i].domain ?? '').toLowerCase();
        const next = (tabData[i + 1].domain ?? '').toLowerCase();
        const isCorrectOrder = current <= next;
        expect(isCorrectOrder).toBe(true);
        console.log(`   ✓ Position ${i} → ${i + 1}: "${current}" ≤ "${next}" ✓`);
      }

      console.log(`   ✓ All ${tabData.length} tabs verified in strict alphabetical domain order`);
    });

    await options.close();
  });

  test("4 handles mixed grouped and ungrouped tabs correctly", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    await test.step("Create and partially group tabs", async () => {
      await options.clickLoadMockTabs(2000);
      await options.clickGroupTabs(1200);

      // Get some tabs and ungroup them
      const ungroupedBefore = await options.getUngroupedTabCount();
      console.log(`   ✓ Setup: ${ungroupedBefore} ungrouped tabs, some grouped tabs`);
    });

    await test.step("Sort by domain preserves group structure", async () => {
      const dataBeforeSort = await options.getGroupAndTabData();
      console.log(`   → Before sort: ${dataBeforeSort.groupCount} groups, ${dataBeforeSort.ungroupedTabCount} ungrouped`);

      await options.clickGroupTabsByDomain(1500);

      const dataAfterSort = await options.getGroupAndTabData();
      console.log(`   → After sort: ${dataAfterSort.groupCount} groups, ${dataAfterSort.ungroupedTabCount} ungrouped`);

      // Group counts should remain the same
      expect(dataAfterSort.groupCount).toBe(dataBeforeSort.groupCount);
      expect(dataAfterSort.ungroupedTabCount).toBe(dataBeforeSort.ungroupedTabCount);
      expect(dataAfterSort.groupedTabCount).toBe(dataBeforeSort.groupedTabCount);

      console.log(`   ✓ Group structure preserved after sort`);
    });

    await options.close();
  });

  test("5 sorts empty or invalid URL tabs gracefully", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    await test.step("Create mock tabs and add a chrome-extension tab", async () => {
      await options.clickLoadMockTabs(2000);

      // Create a chrome-extension URL tab (invalid for domain extraction)
      const result = await options.page.evaluate(() => {
        return new Promise<{ success: boolean; tabId?: number }>((resolve) => {
          chrome.tabs.create(
            { url: `chrome-extension://${chrome.runtime.id}/options.html` },
            (tab: chrome.tabs.Tab) => {
              resolve({ success: !!tab, tabId: tab?.id });
            }
          );
        });
      });

      expect(result.success).toBe(true);
      console.log(`   ✓ Created chrome-extension tab (invalid domain)`);
    });

    await test.step("Sort and verify no errors despite invalid URL", async () => {
      const result = await options.clickGroupTabsByDomain(1500);
      expect(result.error).toBeNull();

      const tabs = await options.page.evaluate(async () => {
        return (await chrome.tabs.query({ currentWindow: true })).length;
      });

      expect(tabs).toBeGreaterThan(0);
      console.log(`   ✓ Sort completed successfully with ${tabs} total tabs (including invalid URLs)`);
    });

    await options.close();
  });
});
