/**
 * Threshold Persistence Test
 * 
 * Verifies that threshold levels are properly saved to storage
 * and restored when the options page is reloaded
 */

import { test, expect } from '@playwright/test';
import { setupExtensionTest, type ExtensionTestContext } from './chromium/extensions.js';
import { OptionsPage } from './page-objects/OptionsPage.js';

test.describe('Threshold Persistence across Reload', () => {
  let ctx: ExtensionTestContext;

  test.beforeAll('Setup', async () => {
    ctx = await setupExtensionTest(false, 60_000);
  });

  test.afterAll('Cleanup', async () => {
    if (ctx) await ctx.cleanup();
  });

  test('Threshold levels persist after page reload', async () => {
    const options = new OptionsPage(await ctx.context.newPage());

    try {
      // Step 1: Load options page
      await options.goto(ctx.extensionId);
      await options.expectPageLoaded();
      console.log('✅ Step 1: Options page loaded');

      // Step 2: Get initial threshold level
      const initialLevel = await options.page.locator('[data-testid="thresholds-levels-input"]').inputValue();
      console.log(`✅ Step 2: Initial threshold level: ${initialLevel}`);
      expect(initialLevel).toBe('5'); // Default is 5

      // Step 3: Change threshold to 3 levels
      await options.page.locator('[data-testid="thresholds-levels-input"]').fill('3');
      console.log('✅ Step 3: Changed threshold to 3 levels');

      // Step 4: Click Apply button to save
      await options.page.locator('[data-testid="threshold-apply"]').click();
      console.log('✅ Step 4: Applied threshold change (saved to storage)');

      // Small wait for storage to persist
      await options.page.waitForTimeout(500);

      // Step 5: Verify Apply button disappeared (no unsaved changes)
      const applyBtn = options.page.locator('[data-testid="threshold-apply"]');
      await expect(applyBtn).not.toBeVisible();
      console.log('✅ Step 5: Apply button hidden - changes saved');

      // Step 6: Close current page
      await options.page.close();
      console.log('✅ Step 6: Closed options page');

      // Step 7: Reload - create fresh options page instance
      const optionsReloaded = new OptionsPage(await ctx.context.newPage());
      await optionsReloaded.goto(ctx.extensionId);
      await optionsReloaded.expectPageLoaded();
      console.log('✅ Step 7: Options page reloaded');

      // Step 8: ⚠️ CRITICAL TEST: Verify threshold is still 3 (NOT reset to 5)
      const reloadedLevel = await optionsReloaded.page.locator('[data-testid="thresholds-levels-input"]').inputValue();
      console.log(`✅ Step 8: After reload, threshold level: ${reloadedLevel}`);
      
      // THIS IS THE KEY TEST - threshold should be 3, not 5 (default)
      expect(reloadedLevel).toBe('3', 'Thresholds should persist after reload, not reset to default');
      console.log('✅ PASSED: Thresholds persisted correctly! (3 levels preserved)');

    } finally {
      // Clean up pages
    }
  });
});
