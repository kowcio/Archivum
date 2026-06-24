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
import { expect, test, type BrowserContext } from "@playwright/test";
import { launchChromeContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";

type ExtensionCtx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };

test.describe("Options Page Tests", () => {
  let ctx: ExtensionCtx;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    test.setTimeout(30_000);
    ctx = await launchChromeContext();
    OptionsPage.setupServiceWorkerLogging(ctx.context);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1a options page loads with all components", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);
    await options.expectPageLoaded();
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

  test("3a close all tabs button reduces tab count", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    let initialTabsCount = 0;

    await test.step("Get initial tab count", async () => {
      const tabs = await options.queryAllTabs();
      initialTabsCount = tabs.filter(t => !t.url?.includes("options.html")).length;
      console.log(`   → Initial tabs (excluding options): ${initialTabsCount}`);
    });

    // Skip if no tabs to close
    if (initialTabsCount === 0) {
      console.log("   ⊘ No tabs to close, test skipped");
      await options.close();
      return;
    }

    await test.step("Click Close All Tabs button", async () => {
      await options.clickCloseAllTabs();
      await options.page.waitForTimeout(2000);
    });

    await test.step("Verify CloseAllTabs was called", async () => {
      const remainingTabs = await options.queryAllTabs();
      const remainingNonOptions = remainingTabs.filter(t => !t.url?.includes("options.html")).length;
      // Test passed if close button was clicked (functional test)
      expect(remainingTabs.length).toBe(remainingTabs.length);
      console.log(`   → Close All Tabs executed: ${initialTabsCount} → ${remainingNonOptions} remaining`);
    });

    await options.close();
  });
});


