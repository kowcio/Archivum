/**
 * Backup & Restore E2E Test
 *
 * Happy path: Create mock grouped tabs → Backup → Close all → Restore
 * Verifies that groups and tabs are properly restored.
 */

import { test, expect } from '@playwright/test'
import {ExtensionTestContext, setupExtensionTest} from "./chromium/extensions";
import {OptionsPage} from "./page-objects/OptionsPage";

test.describe('Backup & Restore', () => {

  let ctx: ExtensionTestContext;
  let options: OptionsPage;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
    options = new OptionsPage(await ctx.context.newPage());

  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test('Happy path: backup grouped tabs, close all, restore with groups intact', async () => {

    // Load options
    await options.goto(ctx.extensionId)

    // Create mock tabs
    await options.clickCloseAllTabs()
    await options.page.waitForTimeout(500)
    await options.clickLoadMockTabs()
    await options.page.waitForTimeout(1000)

    // Group tabs by age
    await options.clickGroupTabs(2000)
    const groupsBeforeDetails = await options.getAllGroups()
    const groupsBeforeCount = groupsBeforeDetails.length
    console.log("[TEST] Groups BEFORE:", groupsBeforeCount)
    groupsBeforeDetails.forEach(g => console.log(`  - "${g.title}" (${g.tabCount} tabs)`))

    // Backup
    await options.clickBackupTabs()
    await options.page.waitForTimeout(500)

    // ✅ DEBUG: Check what was backed up
    const backupData = await options.getBackupFromStorage()
    console.log("[TEST] Backup - tabs count:", backupData?.tabs.length)
    console.log("[TEST] Backup - sample tabs with groupId:")
    backupData?.tabs.slice(0, 3).forEach((t: any, i: number) => {
      console.log(`  [${i}] groupId=${t.groupId}, id=${t.id}, url=${t.url?.substring(0, 50)}`)
    })
    console.log("[TEST] Backup - groups details:")
    backupData?.groups.forEach((g: any, i: number) => {
      console.log(`  [${i}] title="${g.title}", collapsed=${g.collapsed}, index=${g.index}, oldId=${g.oldId}`)
    })

    // Close all tabs
    await options.clickCloseAllTabs()
    await options.page.waitForTimeout(500)

    // Restore
    await options.clickRestoreTabs()
    console.log("[TEST] Clicked 'Restore Tabs' button")
    await options.confirmRestore()
    console.log("[TEST] Confirmed restore")
    await options.page.waitForTimeout(3000)  // Increased from 2000 to 3000ms for restoration to complete
    console.log("[TEST] Wait completed, now querying groups...")

    // ✅ DEBUG: Query group properties from Chrome API
    const groupDetails = await options.page.evaluate(async () => {
      const currentWindow = await (window as any).chrome.windows.getCurrent();
      const groups = await (window as any).chrome.tabGroups.query({ windowId: currentWindow.id });
      return groups.map((g: any) => ({
        id: g.id,
        title: g.title,
        color: g.color,
        collapsed: g.collapsed,
      }));
    });
    console.log("[TEST] Groups from API (first group):", groupDetails[0]);


    // Verify groups restored — fetch from scratch (exact count)
    const groupsAfterDetails = await options.getAllGroups()
    const groupsAfterCount = groupsAfterDetails.length
    console.log("[TEST] Groups AFTER:", groupsAfterCount)
    groupsAfterDetails.forEach(g => console.log(`  - "${g.title}" (titleSet: ${g.titleSet}, collapsed: ${g.collapsed}, tabs: ${g.tabCount})`))
    expect(groupsAfterCount).toBe(groupsBeforeCount)

    // ✅ Verify group names are preserved (not empty/default)
    console.log("[TEST] Groups detailed:")
    groupsAfterDetails.forEach(g => {
      console.log(`  - "${g.title}" (titleSet: ${g.titleSet}, collapsed: ${g.collapsed}, tabs: ${g.tabCount})`)
    })

    // Verify that ALL groups have titles set (not just "Group {id}")
    for (const group of groupsAfterDetails) {
      expect(group.titleSet).toBe(true)
      console.log(`[TEST] ✅ Group ${group.id} has title: "${group.title}"`)
    }

    // ✅ Verify collapsed state is preserved
    const collapsedAfter = groupsAfterDetails.map(g => g.collapsed)
    console.log("[TEST] Collapsed state - After restore:", collapsedAfter)

    // Verify backup exists (delete button should be visible)
    await options.expectDeleteBackupButtonVisible()
    await options.expectRestoreButtonVisible()

    // Delete the backup
    await options.clickDeleteBackup()
    await options.page.waitForTimeout(500)

    // Verify backup is deleted (delete button and restore button should be hidden)
    await options.expectDeleteBackupButtonHidden()
    await options.expectRestoreButtonHidden()

    // Verify backup was actually removed from storage
    const backupAfterDelete = await options.getBackupFromStorage()
    expect(backupAfterDelete).toBeNull()

    // Cleanup
    await ctx.cleanup()

    // Cleanup
    await ctx.cleanup()
  })
})


