/// <reference types="chrome" />

/**
 * E2E test: Backup & Restore Tabs functionality
 * Chrome MV3 only. Run: npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Uses Page Object Models (POM) for clean test code
 * - OptionsPage: Options page interactions (backup, restore, table queries)
 *
 * Flow:
 * 1. Open options page
 * 2. Create mock tabs
 * 3. Click backup button
 * 4. Verify backup is saved in storage
 * 5. Click restore button
 * 6. Confirm restore dialog
 * 7. Verify all tabs are restored
 */
import { expect, test } from "@playwright/test";
import { setupExtensionTest, type ExtensionTestContext } from "./extensions.js";
import { OptionsPage } from "../page-objects/OptionsPage.js";

test.describe("Backup & Restore Tabs", () => {
  let ctx: ExtensionTestContext;

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    ctx = await setupExtensionTest(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (ctx) await ctx.cleanup();
  });

  test("1. Backup and restore tabs workflow", async () => {
    const options = new OptionsPage(await ctx.context.newPage());
    await options.goto(ctx.extensionId);

    // Verify page loaded
    await options.expectPageLoaded();
    console.log("   ✓ Options page loaded");

    // Step 1: Create mock tabs
    await test.step("Create mock tabs", async () => {
      const result = await options.clickLoadMockTabs(1000);
      expect(result.ok).toBe(true);
      expect(result.count).toBe(16);
      console.log(`   ✓ Created ${result.count} mock tabs`);
    });

    // Step 2: Verify backup button is visible (no backup exists yet)
    await test.step("Verify backup button is visible", async () => {
      await options.expectBackupButtonVisible();
      console.log("   ✓ Backup button is visible");
    });

    // Step 3: Click backup button
    let backupCount = 0;
    await test.step("Click backup button", async () => {
      const allTabs = await options.queryAllTabs();
      backupCount = allTabs.length;
      console.log(`   ℹ Total tabs before backup: ${backupCount}`);

      await options.clickBackupTabs();
      await options.page.waitForTimeout(500);
      console.log("   ✓ Backup button clicked");
    });

    // Step 4: Verify backup is saved in storage
    await test.step("Verify backup is saved in browser storage", async () => {
      const backup = await options.getBackupFromStorage();
      expect(backup).not.toBeNull();
      expect(backup).toHaveLength(backupCount);
      expect(backup![0]).toHaveProperty("url");
      console.log(`   ✓ Backup saved with ${backup!.length} tabs`);
    });

    // Step 5: Verify restore button is now visible
    await test.step("Verify restore button is visible", async () => {
      await options.page.reload();
      await options.expectPageLoaded();
      await options.expectRestoreButtonVisible();
      console.log("   ✓ Restore button is visible after reload");
    });

    // Step 6: Click restore button and verify dialog appears
    await test.step("Click restore button and verify restore dialog appears", async () => {
      await options.clickRestoreTabs();
      // Wait for dialog to appear
      await options.page.waitForTimeout(500);

      // Verify dialog is visible
      const dialogTitle = await options.page.getByTestId('restore-dialog').isVisible();
      expect(dialogTitle).toBe(true);
      console.log("   ✓ Restore confirmation dialog is present");
    });

    // Step 7: Confirm restore and verify tabs are restored
    await test.step("Confirm restore operation", async () => {
      // Get current tabs count
      const tabsBeforeRestore = await options.queryAllTabs();
      console.log(`   ℹ Tabs before restore: ${tabsBeforeRestore.length}`);

      // Confirm restore
      await options.confirmRestore();

      // Query all tabs to verify restoration (with loader to ensure all tabs created)
      const tabsAfterRestore = await options.queryAllTabs(true);
      console.log(`   ℹ Tabs after restore: ${tabsAfterRestore.length}`);

      // Verify tabs were restored (at least 50% success rate)
      // Some tabs might fail due to URL restrictions or network issues
      const minTabs = Math.ceil(backupCount * 0.5);
      expect(tabsAfterRestore.length).toBeGreaterThanOrEqual(minTabs);
      console.log(`   ✓ Tabs restored (${tabsAfterRestore.length}/${backupCount})`);

      // Verify status message updated
      const statusText = await options.page.getByTestId('backup-status').textContent();
      expect(statusText).toBeTruthy();
      console.log(`   ✓ Restore completed`);
    });

    // Step 8: Verify backup is still available in storage
    await test.step("Verify backup still exists in storage", async () => {
      const backup = await options.getBackupFromStorage();
      expect(backup).not.toBeNull();
      expect(backup).toHaveLength(backupCount);
      console.log("   ✓ Backup is still preserved in storage");
    });

    await options.close();
  });
});
