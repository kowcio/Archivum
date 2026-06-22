/// <reference types="chrome" />

/**
 * E2E test: Threshold configuration and regrouping
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Uses Page Object Models (POM) for clean test code
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { launchChromeContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";
import { MOCK_TABS } from "../../../src/utils/mockTabData.js";

type ExtensionCtx = { context: BrowserContext; extensionId: string; cleanup: () => Promise<void> };

test.describe("Tab Age Extension E2E Flow", () => {
  let ctx: ExtensionCtx;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
    test.setTimeout(60_000);
    ctx = await launchChromeContext();
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

    let newTabIds: number[] = [];

    // ✅ Create mock tabs
    await test.step("Create mock tabs with backdated ages", async () => {
      const tabsBefore = await options.queryAllTabs();
      const resp = await options.clickLoadMockTabs();
      expect(resp.ok).toBe(true);
      const tabsAfter = await options.queryAllTabs();
      const newTabsCount = tabsAfter.length - tabsBefore.length;
      expect(newTabsCount).toBe(MOCK_TABS.length);

      // Extract new tab IDs
      newTabIds = tabsAfter.slice(tabsBefore.length).map(t => t.id).filter((id): id is number => id != null);
    });

    // ✅ Set mock overrides (backdated ages for each tab)
    await test.step("Set mock tab ages (backdated)", async () => {
      const now = Date.now();
      const DAY_MS = 86400000;
      const overrides: Record<number, number> = {};

      // Age distribution for 4 threshold levels:
      // Fresh (< 7d): tabs 0-1 → 5 days old
      // Week+ (7-13d): tabs 2-3 → 10 days old (FIRST GROUP)
      // 2 Weeks+ (14-27d): tabs 4-5 → 20 days old
      // Month+ (28-89d): tabs 6-7 → 50 days old
      // Quarter+ (90+d): tabs 8-13 → 100 days old

      const ageDistribution = [
        5, 5,             // Fresh (< 7 days)
        10, 10,           // Week+ (7-13 days) - FIRST GROUP
        20, 20,           // 2 Weeks+ (14-27 days)
        50, 50,           // Month+ (28-89 days)
        100, 100, 100, 100, 100, 100  // Quarter+ (90+ days)
      ];

      newTabIds.forEach((tabId, idx) => {
        const age = ageDistribution[idx] ?? 100;
        overrides[tabId] = now - age * DAY_MS;
      });

      await options.setMockOverrides(overrides);
    });

    // ✅ Change threshold levels to 4 and verify grouping
    await test.step("Change thresholds to 4 levels and verify grouping", async () => {
      await options.changeThresholdLevels(4);

      // Extra wait to ensure storage is persisted across contexts
      await options.page.waitForTimeout(1000);

      // Verify the level input still shows 4
      await options.expectLevelsCountEqual(4);

      await options.clickGroupTabs();

      // ✅ Verify group structure directly in test
      await options.page.waitForTimeout(1000);
      const groups = await options.page.evaluate(async () => {
        try {
          const currentWindow = await chrome.windows.getCurrent();
          const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

          const groupDetails = [];
          for (const group of groups) {
            const tabs = await chrome.tabs.query({ groupId: group.id });
            groupDetails.push({
              title: group.title,
              tabCount: tabs.length,
            });
          }
          return groupDetails;
        } catch (err) {
          console.error('[test] Error getting groups:', err);
          return [];
        }
      });

      // Log group structure
      console.log('[TEST] === GROUP STRUCTURE (left to right) ===');
      groups.forEach((g, idx) => {
        console.log(`[TEST] Group ${idx + 1}: "${g.title}" (${g.tabCount} tabs)`);
      });
      const ungroupedCount = await options.getUngroupedTabCount();
      console.log(`[TEST] Fresh ungrouped tabs: ${ungroupedCount}`);
      console.log('[TEST] === END GROUP STRUCTURE ===');

      // Verify first group should be Quarter+ (oldest on left)
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0].title).toContain('Quarter+');

      // Verify last group should be Week+ (youngest on right)
      expect(groups[groups.length - 1].title).toContain('Week+');

      // Verify we have the expected number of groups
      await options.expectGroupCountEqual(4);
    });

    await options.close();
  });

});
