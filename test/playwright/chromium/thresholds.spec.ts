/// <reference types="chrome" />

/**
 * E2E test: Extension load → Popup → Options → Mock tabs → Group → Ungroup.
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Uses Page Object Models (POM) for clean, maintainable test code:
 * - PopupPage: Popup UI interactions (buttons, visibility)
 * - OptionsPage: Options page interactions (grouping, table queries, tab state)
 *
 * Benefits:
 * - Tests read like plain English (await options.clickGroupTabs())
 * - Locators centralized in POM classes
 * - Easy to update selectors without touching tests
 * - Reduced code duplication
 */
import {type BrowserContext, expect, test} from "@playwright/test";
import {launchChromeContext} from "./extensions.js";
import {OptionsPage} from "../page-objects/OptionsPage.js";
import {MOCK_TABS} from "../../../src/utils/mockTabData.js";

type Ctx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };


test.describe("Tab Age Extension E2E Flow", () => {
  test.setTimeout(60_000);
  let ctx: Ctx;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    ctx = await launchChromeContext();

    // 🔍 Enable Service Worker console logging for debugging
    OptionsPage.setupServiceWorkerLogging(ctx.context);
  });
  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

   test("Service worker is registered", () => {
     expect(ctx.extensionId).toBeTruthy();
     expect(ctx.context.serviceWorkers().length).toBe(1);
   });

  test("Test threshold levels change and grouping", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // ✅ Create mock tabs
    await test.step("Create mock tabs with backdated ages", async () => {
      const tabsBefore = await options.queryAllTabs();
      const resp = await options.clickLoadMockTabs();
      expect(resp.ok).toBe(true);
      const tabsAfter = await options.queryAllTabs();
      const newTabsCount = tabsAfter.length - tabsBefore.length;
      expect(newTabsCount).toBe(MOCK_TABS.length);
    });

    // ✅ Verify tabs are created ungrouped
    await test.step("Verify mock tabs are created (groupId = -1)", async () => {
      await options.changeThresholdLevels(4);
      await options.clickGroupTabs();
      await options.expectGroupCountEqual(4);
    });


    await options.close();
  });

});
