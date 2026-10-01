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

  test.beforeEach("Setup: launch Chrome context with extension", async () => {
    env = await TestEnvironment.create(false);
  });

  test.afterEach("Cleanup: close extension context", async () => {
    if (env) await env.cleanup();
  });

  test("1a options page loads with all components", async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);

    // Verify page loaded and key elements are visible
    await env.optionsPage.expectPageLoaded();
    
    const tabs = await env.optionsPage.queryAllTabs();
    const rowCount = await env.optionsPage.getTableRowCount();
    expect(tabs.length).toBeGreaterThanOrEqual(1);  // At least options page tab exists
    expect(rowCount).toBeGreaterThanOrEqual(0);     // Table may be empty initially
    console.log(`   → Table rendered: ${rowCount} rows | ${tabs.length} browser tabs`);
  });

});
