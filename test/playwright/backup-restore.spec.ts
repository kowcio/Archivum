/**
 * Backup & Restore E2E Test
 *
 * Happy path: Create mock grouped tabs → Backup → Close all → Restore
 * Verifies that groups and tabs are properly restored.
 */

import { test, expect } from '@playwright/test'
import { TestEnvironment } from "./chromium/extensions.js";

test.describe('Backup & Restore', () => {

  let env: TestEnvironment

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    env = await TestEnvironment.create(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (env) await env.cleanup();
  });

  test('Happy path: backup grouped tabs, close all, restore with groups intact', async () => {

    // Guard: ensure setup succeeded
    if (!env) {
      throw new Error('Setup failed: Extension context not initialized');
    }

    // Load options
    await env.optionsPage.goto(env.extensionId)

    // Create mock tabs
    await env.optionsPage.clickLoadMockTabs()

    // Group tabs by age
    await env.optionsPage.clickGroupTabs()
    const groupsBeforeDetails = await env.optionsPage.getAllGroups()
    const groupsBeforeCount = groupsBeforeDetails.length
    console.log("[TEST] Groups BEFORE:", groupsBeforeCount)
    groupsBeforeDetails.forEach(g => console.log(`  - "${g.title}" (${g.tabCount} tabs)`))

    // Backup
    await env.optionsPage.clickBackupTabs()

    // ✅ DEBUG: Check what was backed up
    const backupData = await env.optionsPage.getBackupFromStorage()
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
    await env.optionsPage.clickCloseAllTabs()

    // Restore
    await env.optionsPage.clickRestoreTabs()
    console.log("[TEST] Clicked 'Restore Tabs' button")
    await env.optionsPage.confirmRestore()
    console.log("[TEST] Confirmed restore")
    console.log("[TEST] Now querying groups...")

    // Wait for all groups to be fully restored (exact count)
    await expect.poll(
      async () => {
        const groups = await env.optionsPage.getAllGroups();
        return groups.length;
      },
      { timeout: 15_000, message: 'All groups fully restored' }
    ).toBe(groupsBeforeCount);

    // ✅ DEBUG: Query group properties from Chrome API
    const groupDetails = await env.optionsPage.page.evaluate(async () => {
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
    const groupsAfterDetails = await env.optionsPage.getAllGroups()
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
    await env.optionsPage.expectDeleteBackupButtonVisible()
    await env.optionsPage.expectRestoreButtonVisible()

    // Delete the backup
    await env.optionsPage.clickDeleteBackup()

    // Verify backup is deleted (delete button and restore button should be hidden)
    await env.optionsPage.expectDeleteBackupButtonHidden()
    await env.optionsPage.expectRestoreButtonHidden()

    // Verify backup was actually removed from storage
    const backupAfterDelete = await env.optionsPage.getBackupFromStorage()
    expect(backupAfterDelete).toBeNull()
  })
})

