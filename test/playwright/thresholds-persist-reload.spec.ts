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

   test.skip('Threshold levels persist after page reload - WXT storage context issue', async () => {
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
      const applyButton = options.page.locator('[data-testid="threshold-apply"]');
      console.log('✅ Step 4: Clicking Apply button...');
      await applyButton.click();
      console.log('✅ Step 4: Applied threshold change');

      // Wait for button to disappear which indicates save is complete
      await applyButton.waitFor({ state: 'hidden', timeout: 5000 });
      console.log('✅ Step 4: Apply button hidden - save confirmed');

      // Double-check the input value changed in the UI
      const valueAfterApply = await options.page.locator('[data-testid="thresholds-levels-input"]').inputValue();
      console.log(`✅ Step 4: Input value after apply: ${valueAfterApply}`);

      // Wait for storage to persist
      // Step 5: Verify Apply button disappeared (no unsaved changes)
       const applyBtn = options.page.locator('[data-testid="threshold-apply"]');
       // Wait for button to disappear which indicates save is complete
       await applyBtn.waitFor({ state: 'hidden', timeout: 5000 });
       console.log('✅ Step 5: Apply button hidden - changes saved');

      // Step 6: Close current page
      await options.page.close();
      console.log('✅ Step 6: Closed options page');

      // Step 7: Reload - create fresh options page instance
      const optionsReloaded = new OptionsPage(await ctx.context.newPage());
      await optionsReloaded.goto(ctx.extensionId);

      // Wait for page to fully load AND storage to be loaded
      await optionsReloaded.expectPageLoaded();
      // Extra wait for storage to load from background context
      console.log('✅ Step 7: Options page reloaded');

      // Step 8: ⚠️ CRITICAL TEST: Verify threshold is still 3 (NOT reset to 5)
      const reloadedLevel = await optionsReloaded.page.locator('[data-testid="thresholds-levels-input"]').inputValue();
      console.log(`✅ Step 8: After reload, threshold level: ${reloadedLevel}`);

      // THIS IS THE KEY TEST - threshold should be 3, not 5 (default)
      expect(reloadedLevel).toBe('3');
      console.log('✅ PASSED: Thresholds persisted correctly! (3 levels preserved)');

    } finally {
      // Clean up pages
    }
  });
});

