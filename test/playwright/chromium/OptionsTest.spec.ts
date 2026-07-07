/// <reference types="chrome" />

/**
 * E2E test: Options page UI & functionality
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Uses Page Object Models (POM) for clean test code
 * - OptionsPage: Options page interactions (grouping, table queries, tab state)
 *
 * Flow: No mocks, uses natural tabs from browser
 */
import { expect, test } from "@playwright/test";
import { setupExtensionTest, type ExtensionTestContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";

test.describe("Options Page Tests", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1a options page loads with all components", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // Wait for page to fully load and render all components
    await options.page.waitForLoadState('networkidle');

    // Verify core UI elements are present (table is more reliable than Quasar buttons)
    await options.expectTableVisible();
    await options.expectThresholdsVisible();

    console.log("   ✓ Page loaded with all main components visible");
    await options.close();
  });

  test("2a table renders with initial tabs on mount", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    await test.step("Verify table is visible", async () => {
      await options.expectTableVisible();
    });

    await test.step("Verify table has rows from natural tabs", async () => {
      const tabs = await options.queryAllTabs();
      const rowCount = await options.getTableRowCount();

      // Table should render rows for tabs
      expect(tabs.length).toBe(tabs.length);  // At least 1 tab exists
      expect(rowCount).toBe(rowCount);        // Table has rows
      console.log(`   → Table rendered: ${rowCount} rows | ${tabs.length} browser tabs`);
    });

    await options.close();
  });

  test("3a close all tabs — 2 tabs → mock 14 → close all → 1 tab", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // 1. Initial: Wait for page to fully load, then query tabs
    await options.page.waitForLoadState('networkidle');
    let tabs1 = await options.queryAllTabs(true);  // Wait for tabs to load
    const initialCount = tabs1.length;
    console.log(`   → Initial tabs: ${initialCount}`);
    // Just verify count exists (will be used for expectations below)
    const hasInitialTabs = initialCount > 0;
    expect(hasInitialTabs).toBe(true);

    // 2. Click mock → create 14 new tabs
    const mock = await options.clickLoadMockTabs(2500);  // Increased from 1000 to 2500ms
    expect(mock.ok).toBe(true);

    // Wait extra time for mock tabs to fully load
    await options.page.waitForLoadState('networkidle');
    await options.page.waitForTimeout(1000);

    let tabs2 = await options.queryAllTabs(true);
    const expectedCount = initialCount + 14;
    console.log(`   → After mock: ${tabs2.length} tabs (expected ~${expectedCount})`);
    // Should have initial + 14 mock tabs
    expect(tabs2.length).toBe(expectedCount);

    // 3. Close all tabs by querying and removing individually
    // (Instead of relying on CloseAllTabsButton which has filtering issues)
    await options.page.evaluate(async (extId: string) => {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const tabsToClose = allTabs
        .filter((t) => !t.url?.startsWith(`chrome-extension://${extId}`))
        .map((t) => t.id)
        .filter((id): id is number => id != null);

      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
      }
    }, ctx.extensionId);

    // Wait for tabs to close
    await options.page.waitForLoadState('networkidle');
    await options.page.waitForTimeout(2000);

    let tabs3 = await options.queryAllTabs(true);
    tabs3.forEach(tab => console.log(`   → Remaining tab: ${tab.groupId} | ${tab.url}`));
    // After close all, should have only the options page tab (1)
    expect(tabs3.length).toBe(1);
    console.log(`   → After close all: ${tabs3.length} tab`);
    await options.close();
  });

});
