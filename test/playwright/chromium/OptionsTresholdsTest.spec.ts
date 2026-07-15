/// <reference types="chrome" />

/**
 * E2E test: Thresholds and grouping flow
 * Chrome MV3 only. Run: npm run build-only && npx playwright test OptionsTresholdsTest
 */
import { expect, test } from "@playwright/test";
import { setupExtensionTest, type ExtensionTestContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";

test.describe("Thresholds", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll(async () => {
    ctx = await setupExtensionTest(false, 60_000);
  });

  test.afterAll(async () => {
    if (ctx) await ctx.cleanup();
  }, { timeout: 60_000 });  // Increased from default 30s to 60s

  test("Default thresholds → group tabs → change to 5 levels → verify groups", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);
    await options.expectPageLoaded()

    const resp = await options.clickLoadMockTabs();
    expect(resp.ok).toBe(true);

    const thresholdLevels5 = await options.getLevelsCount();
    console.log("Threshold levels ", thresholdLevels5)

    await options.clickGroupTabs();

     let result = await options.getAllGroups();
     expect(result.length).toBe(5);
     expect(result[0].title).toContain('Hell!');
     expect(result[1].title).toContain('Quarter+');
     expect(result[2].title).toContain('Month+');
     expect(result[3].title).toContain('2 Weeks+');
     expect(result[4].title).toContain('Week+');


    await options.changeThresholdLevels(3, 2000);
    const thresholdLevels3 = await options.getLevelsCount();
    expect(thresholdLevels3).toBe(3);

     result = await options.getAllGroups();
     expect(result.length).toBe(3);
     expect(result[0].title).toContain('Month+');
     expect(result[1].title).toContain('2 Weeks+');
     expect(result[2].title).toContain('Week+');


    // Verify ungrouped tabs are at the end after all grouped tabs
    const allTabs = await options.queryAllTabs();
    const groupedCount = result.reduce((acc, group) => acc + group.tabCount, 0);
    allTabs.slice(groupedCount).forEach(tab => expect(tab.groupId).toBe(-1));

    await options.close();
  });

});
