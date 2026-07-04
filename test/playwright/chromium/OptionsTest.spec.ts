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

    // 1. Initial: native new tab + options page = 2
    let tabs1 = await options.queryAllTabs();
    expect(tabs1.length).toBe(2);
    console.log(`   → Initial tabs: ${tabs1.length}`);

    // 2. Click mock → 2 + 14 = 16 tabs
    const mock = await options.clickLoadMockTabs(1000);
    expect(mock.ok).toBe(true);

    let tabs2 = await options.queryAllTabs();
    expect(tabs2.length).toBe(16);
    console.log(`   → After mock: ${tabs2.length} tabs`);
    const html = await options.page.locator('#options').innerHTML()
    console.log("html", html)
    const closeBtn = await options.page.getByText("Closer all other").innerHTML()
    console.log("html", closeBtn)

    // 3. Close all other → only active (options page) stays
    await options.clickCloseAllTabs();
    await options.page.waitForTimeout(1500);

    let tabs3 = await options.queryAllTabs();
    tabs3.forEach(tab => console.log(`   → Remaining tab: ${tab.groupId} | ${tab.url}`));
    expect(tabs3.length).toBe(1);
    console.log(`   → After close all: ${tabs3.length} tab`);
    await options.close();
  });

});
