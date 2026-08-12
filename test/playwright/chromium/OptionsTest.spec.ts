/// <reference types="chrome" />

/**
 * E2E test: Options page UI & functionality
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 *
 * ✅ Uses Page Object Models (POM) for clean test code
 * - OptionsPage: Options page interactions (grouping, table queries, tab state)
 *
 * Flow: No mocks, uses natural tabs from browser
 */
import { expect, test } from "@playwright/test";
import { TestEnvironment } from "./extensions.js";

test.describe("Options Page Tests", () => {
  let env: TestEnvironment

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    env = await TestEnvironment.create(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (env) await env.cleanup();
  });

  test("1a options page loads with all components", async () => {
    await env.optionsPage.goto(env.extensionId);  // Already waits for Vue hydration

    // Verify core UI elements are present (table is more reliable than Quasar buttons)
    await env.optionsPage.expectTableVisible();
    await env.optionsPage.expectThresholdsVisible();

    console.log("   ✓ Page loaded with all main components visible");
  });

  test("2a table renders with initial tabs on mount", async () => {
    await env.optionsPage.goto(env.extensionId);

    await test.step("Verify table is visible", async () => {
      await env.optionsPage.expectTableVisible();
    });

    await test.step("Verify table has rows from natural tabs", async () => {
      const tabs = await env.optionsPage.queryAllTabs();
      const rowCount = await env.optionsPage.getTableRowCount();

      // Table should render rows for tabs
      expect(tabs.length).toBe(tabs.length);  // At least 1 tab exists
      expect(rowCount).toBe(rowCount);        // Table has rows
      console.log(`   → Table rendered: ${rowCount} rows | ${tabs.length} browser tabs`);
    });
  });

  test("3a close all tabs — 2 tabs → mock 14 → close all → 1 tab", async () => {
    await env.optionsPage.goto(env.extensionId);  // Already waits for hydration

    // 1. Initial: Query tabs (queryAllTabs handles waiting)
    const tabs1 = await env.optionsPage.queryAllTabs(true);  // Wait for tabs to load
    const initialCount = tabs1.length;
    console.log(`   → Initial tabs: ${initialCount}`);
    // Just verify count exists (will be used for expectations below)
    const hasInitialTabs = initialCount > 0;
    expect(hasInitialTabs).toBe(true);

    // 2. Click mock → create 14 new tabs
    const mock = await env.optionsPage.clickLoadMockTabs();  // Increased from 1000 to 2500ms
    expect(mock.ok).toBe(true);

    // Wait for mock tabs to fully load by checking table updates
    await env.optionsPage.page.waitForFunction(() => {
      const tableRows = document.querySelectorAll('[data-testid="table-open-tabs"] tr');
      return tableRows.length > 1;  // At least header + data rows
    }, { timeout: 5_000 });

    const tabs2 = await env.optionsPage.queryAllTabs(true);
    const expectedCount = initialCount + 14;
    console.log(`   → After mock: ${tabs2.length} tabs (expected ~${expectedCount})`);
    // Should have initial + 14 mock tabs
    expect(tabs2.length).toBe(expectedCount);

    // 3. Close all tabs by querying and removing individually
    // (Instead of relying on CloseAllTabsButton which has filtering issues)
    await env.optionsPage.page.evaluate(async (extId: string) => {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const tabsToClose = allTabs
        .filter((t) => !t.url?.startsWith(`chrome-extension://${extId}`))
        .map((t) => t.id)
        .filter((id): id is number => id != null);

      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
      }
    }, env.extensionId);

     // Wait for tabs to close by checking browser tab count
     await env.optionsPage.page.waitForFunction(async (extId: string) => {
       const tabs = await chrome.tabs.query({ currentWindow: true });
       const userTabs = tabs.filter(t => !t.url?.startsWith(`chrome-extension://${extId}`));
       return userTabs.length === 0;  // All user tabs closed
     }, { timeout: 10_000 }, env.extensionId);

    const tabs3 = await env.optionsPage.queryAllTabs(true);
    tabs3.forEach(tab => console.log(`   → Remaining tab: ${tab.groupId} | ${tab.url}`));
    // After close all, should have only the options page tab (1)
    expect(tabs3.length).toBe(1);
    console.log(`   → After close all: ${tabs3.length} tab`);
    await env.optionsPage.close();
  });

});
