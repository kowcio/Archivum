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
      expect(tabs.length).toBe(rowCount);
      expect(tabs.length).toBeGreaterThan(0);
      console.log(`   → Table rendered: ${rowCount} rows | ${tabs.length} browser tabs`);
    });

    await options.close();
  });

  test("3a close all tabs button closes tabs", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    let initialTabsCount = 0;
    await test.step("Get initial tab count", async () => {
      const tabs = await options.queryAllTabs();
      initialTabsCount = tabs.length;
      console.log(`   → Initial tabs: ${initialTabsCount}`);
    });

    await test.step("Click Close All Tabs button", async () => {
      await options.clickCloseAllTabs();
      await options.page.waitForTimeout(500);
    });

    await test.step("Verify tabs are closed", async () => {
      const remainingTabs = await options.queryAllTabs();
      expect(remainingTabs.length).toBe(0);
      console.log(`   → All ${initialTabsCount} tabs closed ✓`);
    });

    await options.close();
  });
});


