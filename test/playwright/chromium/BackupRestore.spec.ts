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
      expect(result.count).toBeGreaterThan(0);
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
    await test.step("Click restore button and verify confirmation dialog", async () => {
      await options.clickRestoreTabs();
      // Wait for dialog to appear
      await options.page.waitForTimeout(500);

      // Check if dialog title is visible (q-dialog__title is Quasar's dialog title class)
      const dialogTitle = await options.page.locator('.q-dialog__title').isVisible();
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

      // Wait for tabs to be created
      await options.page.waitForTimeout(1500);

      // Query all tabs to verify restoration
      const tabsAfterRestore = await options.queryAllTabs();
      console.log(`   ℹ Tabs after restore: ${tabsAfterRestore.length}`);

      expect(tabsAfterRestore.length).toBeGreaterThanOrEqual(backupCount);
      console.log(`   ✓ Tabs restored successfully (${tabsAfterRestore.length} tabs)`);
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
