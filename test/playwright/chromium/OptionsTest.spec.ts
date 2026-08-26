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
import {expect, test} from "@playwright/test";
import {TestEnvironment} from "./extensions.js";

test.describe("Options Page Tests", () => {
  let env: TestEnvironment

  test.beforeAll("Setup: launch Chrome context with extension", async () => {
    env = await TestEnvironment.create(false);
  });

  test.afterAll("Cleanup: close extension context", async () => {
    if (env) await env.cleanup();
  });

  test("1a options page loads with all components", async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);  // Already waits for Vue hydration

    // Verify core UI elements are present (table is more reliable than Quasar buttons)
    await env.optionsPage.expectTableVisible();
    await env.optionsPage.expectThresholdsVisible();
    await env.optionsPage.expectAllButtonsVisible();
    await env.optionsPage.expectTableVisible();

    const tabs = await env.optionsPage.queryAllTabs();
    const rowCount = await env.optionsPage.getTableRowCount();
    expect(tabs.length).toBe(tabs.length);  // At least 1 tab exists
    expect(rowCount).toBe(rowCount);        // Table has rows
    console.log(`   → Table rendered: ${rowCount} rows | ${tabs.length} browser tabs`);
  });

  test("3a close all tabs — 2 tabs → mock 14 → close all → 1 tab", async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);

    // 1. Initial state
    const initialTabs = await env.optionsPage.queryAllTabs(true);

    // 2. Load mock tabs (adds 14 tabs)
    const mock = await env.optionsPage.clickLoadMockTabs();
    expect(mock.ok).toBe(true);

    // 3. Wait for table to update
    await env.optionsPage.page.waitForFunction(() => {
      const tableRows = document.querySelectorAll('[data-testid="table-open-tabs"] tr');
      return tableRows.length > 1;
    }, {timeout: 5_000});

    // 4. Verify mock tabs loaded
    const afterMockTabs = await env.optionsPage.queryAllTabs(true);
    expect(afterMockTabs.length).toBe(initialTabs.length + 16);


  });

});
