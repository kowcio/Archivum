/// <reference types="chrome" />

/**
 * E2E test: Thresholds and grouping flow
 * Chrome MV3 only. Run: npm run build-only && npx playwright test OptionsTresholdsTest
 */
import { expect, test } from "@playwright/test";
import { TestEnvironment } from "./extensions.js";

test.describe("Thresholds", () => {
  let env: TestEnvironment

  test.beforeAll('Setup', async () => {
    env = await TestEnvironment.create(false, 60_000);
  });

  test.afterAll('Cleanup', async () => {
    if (env) await env.cleanup();
  });

  test("Default thresholds → group tabs → change to 5 levels → verify groups", async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded()

    const resp = await env.optionsPage.clickLoadMockTabs();
    expect(resp.ok).toBe(true);

    const thresholdLevels5 = await env.optionsPage.getLevelsCount();
    console.log("Threshold levels ", thresholdLevels5)

    await env.optionsPage.clickGroupTabs();

     let result = await env.optionsPage.getAllGroups();
     expect(result.length).toBe(5);
     expect(result[0].title).toContain('Hell!');
     expect(result[1].title).toContain('Quarter+');
     expect(result[2].title).toContain('Month+');
     expect(result[3].title).toContain('2 Weeks+');
     expect(result[4].title).toContain('Week+');

    await env.optionsPage.changeThresholdLevels(3, 2000);
    const thresholdLevels3 = await env.optionsPage.getLevelsCount();
    expect(thresholdLevels3).toBe(3);

     result = await env.optionsPage.getAllGroups();
     expect(result.length).toBe(3);
     expect(result[0].title).toContain('Month+');
     expect(result[1].title).toContain('2 Weeks+');
     expect(result[2].title).toContain('Week+');

    // Verify ungrouped tabs are at the end after all grouped tabs
    const allTabs = await env.optionsPage.queryAllTabs();
    const groupedCount = result.reduce((acc, group) => acc + group.tabCount, 0);
    allTabs.slice(groupedCount).forEach(tab => expect(tab.groupId).toBe(-1));

    await env.optionsPage.close();
  });

});
