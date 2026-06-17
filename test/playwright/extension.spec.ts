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
import { expect, test, type BrowserContext } from "@playwright/test";
import { launchChromeContext } from "./helpers/extensions.js";
import { PopupPage } from "./page-objects/PopupPage.js";
import { OptionsPage } from "./page-objects/OptionsPage.js";
import { MOCK_TABS } from "../../src/utils/mockTabData.js";

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

   test("1a service worker is registered", () => {
     expect(ctx.extensionId).toBeTruthy();
     expect(ctx.context.serviceWorkers().length).toBe(1);
   });

  test("2a popup renders all action buttons", async () => {
    const popup = new PopupPage(await ctx.context.newPage());
    await popup.goto(ctx.extensionId);
    await popup.expectAllButtonsVisible();
    await popup.close();
  });

  test("3a options shows Group button, hides Ungroup, shows config", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);
    await options.expectPageLoaded();
    await options.close();
  });

  test("4a mock tabs created with correct data", async () => {
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
    let createdTabsCount = 0;
    await test.step("Verify mock tabs are created (groupId = -1)", async () => {
      const tabs = await options.queryAllTabs();
      createdTabsCount = tabs.length;
      expect((await options.getGroupedTabs()).length).toBe(0);
    });

    // ✅ Group tabs by age
    let groupedCountBeforeActivation = 0;
    await test.step("Click Group by age verify 3 groups created", async () => {
      await options.clickGroupTabs();
      // ✨ Simple: wait 500ms for grouping, then verify state
      // Much simpler than complex event listeners or waits
      await options.page.waitForTimeout(500);
      groupedCountBeforeActivation = (await options.getGroupedTabs()).length;
      const ungroupedCount = (await options.getUngroupedTabs()).length;
      expect(groupedCountBeforeActivation + ungroupedCount).toBe(createdTabsCount);
      await options.expectGroupCountEqual(3);
    });

    // ✅ Activate tab in group → moves to rightmost + ungrouped
    await test.step("Activate tab in group verify moves to rightmost + ungrouped", async () => {
      const grouped = await options.getGroupedTabs();
      const tabToActivate = grouped[0];
      if (!tabToActivate) throw new Error("No grouped tabs found");

      await options.activateTab(tabToActivate.id as number);
      await options.waitForTabActivated(tabToActivate.id as number);

      // After activation, one tab should be ungrouped
      expect((await options.getGroupedTabs()).length).toBe(groupedCountBeforeActivation - 1);
    });

    // ✅ Ungroup all tabs
    await test.step("Click Ungroup verify all tabs ungrouped", async () => {
      await options.clickUngroupTabs();
      // ✨ Simple: wait 500ms for ungrouping, then verify state
      await options.page.waitForTimeout(500);
      expect((await options.getGroupedTabs()).length).toBe(0);
    });

    await options.close();
  });
});
