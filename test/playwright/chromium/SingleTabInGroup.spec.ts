/// <reference types="chrome" />


import { expect, test } from "@playwright/test";
import { setupExtensionTest, type ExtensionTestContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";

test.describe("Options Page Tests", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(true);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("Single tab is left in one of our groups after click it should be ungrouped.", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // 1. Create mock tabs (14 tabs with varying ages from 1 to 367 days)
    const resp = await options.clickLoadMockTabs(1000);
    expect(resp.ok).toBe(true);
    expect(resp.count).toBe(16);
    console.log(`   → Created ${resp.count} mock tabs`);

    // 2. Group tabs by age with default 5 levels
    await options.clickGroupTabs();
    await options.expectUngroupButtonVisible();

    // 3. Verify Week+ group has 3 tabs (daysAgo 8, 8, 12 → 7 < days ≤ 14)
    const groups = await options.getAllGroups();
    const weekGroup = groups.find(g => g.title.startsWith('Week+'));
    expect(weekGroup).toBeDefined();
    expect(weekGroup!.tabCount).toBe(3);
    const weekGroupId = weekGroup!.id;
    console.log(`   → Week+ group has ${weekGroup!.tabCount} tabs (groupId=${weekGroupId})`);

    // 4. Get the tab IDs in the Week+ group
    const allTabs = await options.queryAllTabs();
    const weekGroupTabs = allTabs.filter(t => t.groupId === weekGroupId);
    expect(weekGroupTabs.length).toBe(3);

    // 5. Activate each tab one by one — each should ungroup and move to rightmost
    for (let i = 0; i < weekGroupTabs.length; i++) {
      const tabId = weekGroupTabs[i].id!;
      console.log(`   → Activating tab#${tabId} (${i + 1}/${weekGroupTabs.length}) in Week+ group`);

      await options.activateTab(tabId);
      await options.waitForTabActivated(tabId);

      // Verify the activated tab is now ungrouped
      const tabsAfter = await options.queryAllTabs();
      const tabState = tabsAfter.find(t => t.id === tabId);
      expect(tabState).toBeDefined();
      expect(tabState!.groupId).toBe(-1);
      console.log(`   → Tab#${tabId} successfully ungrouped`);
    }

    // 6. Small wait for Chrome to auto-remove the now-empty Week+ group
    await options.page.waitForTimeout(500);

    // 7. Verify Week+ group no longer exists (Chrome auto-removes empty groups)
    const groupsAfter = await options.getAllGroups();
    const weekGroupAfter = groupsAfter.find(g => g.title.startsWith('Week+'));
    expect(weekGroupAfter).toBeUndefined();
    console.log("   → Week+ group auto-removed (0 tabs left)");

    // 8. Other groups still remain unaffected
    expect(groupsAfter.length).toBe(4);
    expect(groupsAfter.some(g => g.title.startsWith('2 Weeks+'))).toBe(true);
    expect(groupsAfter.some(g => g.title.startsWith('Month+'))).toBe(true);
    expect(groupsAfter.some(g => g.title.startsWith('Quarter+'))).toBe(true);
    expect(groupsAfter.some(g => g.title.startsWith('Eat that frog!'))).toBe(true);

    await options.close();
  });

});
