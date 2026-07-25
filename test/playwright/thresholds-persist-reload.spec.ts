/**
 * Threshold Persistence Test
 *
 * Verifies that threshold levels are properly saved to storage
 * and restored when the options page is reloaded
 */

import { test, expect } from '@playwright/test';
import { TestEnvironment } from './chromium/extensions.js';
import { OptionsPage } from './page-objects/OptionsPage.js';

test.describe('Threshold Persistence across Reload', () => {
  let env: TestEnvironment

  test.beforeAll('Setup', async () => {
    env = await TestEnvironment.create(false, 60_000);
  });

  test.afterAll('Cleanup', async () => {
    if (env) await env.cleanup();
  });

   test.skip('Threshold levels persist after page reload - WXT storage context issue', async () => {

    try {
      // Step 1: Load options page
      await env.optionsPage.goto(env.extensionId);
      await env.optionsPage.expectPageLoaded();
      console.log('✅ Step 1: Options page loaded');

      // Step 2: Get initial threshold level
      const initialLevel = await env.optionsPage.page.locator('[data-testid="thresholds-levels-input"]').inputValue();
      expect(initialLevel).toBe('5'); // Default is 5

      // Step 3: Change threshold to 3 levels
      await env.optionsPage.page.locator('[data-testid="thresholds-levels-input"]').fill('3');

      // Step 4: Click Apply button to save
      const applyButton = env.optionsPage.page.locator('[data-testid="threshold-apply"]');
      await applyButton.click();

      // Wait for button to disappear which indicates save is complete
      await applyButton.waitFor({ state: 'hidden', timeout: 5000 });

      // Double-check the input value changed in the UI
      const valueAfterApply = await env.optionsPage.page.locator('[data-testid="thresholds-levels-input"]').inputValue();

      // Wait for storage to persist
      // Step 5: Verify Apply button disappeared (no unsaved changes)
       const applyBtn = env.optionsPage.page.locator('[data-testid="threshold-apply"]');
       // Wait for button to disappear which indicates save is complete
       await applyBtn.waitFor({ state: 'hidden', timeout: 5000 });
       console.log('✅ Step 5: Apply button hidden - changes saved');

      // Step 6: Reload the page (simulates browser refresh - storage persists, page reloads)
      await env.optionsPage.page.reload({ waitUntil: 'domcontentloaded' });
      console.log('✅ Step 6: Page reloaded');

      // Wait for page to fully load after reload
      await env.optionsPage.expectPageLoaded();

      // Wait for page to fully load AND storage to be loaded
      console.log('✅ Step 7: Options page reloaded');

      // Step 8: ⚠️ CRITICAL TEST: Verify threshold is still 3 (NOT reset to 5)
      const reloadedLevel = await env.optionsPage.page.locator('[data-testid="thresholds-levels-input"]').inputValue();
      console.log(`✅ Step 8: After reload, threshold level: ${reloadedLevel}`);

      // THIS IS THE KEY TEST - threshold should be 3, not 5 (default)
      expect(reloadedLevel).toBe('3');
      console.log('✅ PASSED: Thresholds persisted correctly! (3 levels preserved)');

    } finally {
      // Clean up pages
    }
  });
});

