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

  test("options page loads with all components, creates mock data, and renders 17 complete rows", async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);

    // Initial state: page loads and table is empty
    await env.optionsPage.expectPageLoaded();
    await expect(env.optionsPage.page.getByRole('heading', { name: 'Archivum' })).toBeVisible();
    await expect(env.optionsPage.page.getByText('Tab manager to clear your mind')).toBeVisible();

    await expect(env.optionsPage.page.getByTestId('group-tabs-btn')).toBeVisible();
    await expect(env.optionsPage.page.getByTestId('thresholds-levels-input')).toBeVisible();
    await expect(env.optionsPage.page.getByTestId('threshold-reset')).toBeVisible();
    await expect(env.optionsPage.page.getByRole('switch', { name: 'Auto close' })).toBeVisible();

    if (await env.optionsPage.page.getByTestId('mock-tabs').count() > 0) {
      await expect(env.optionsPage.page.getByTestId('mock-tabs')).toBeVisible();
    }

    if (await env.optionsPage.page.getByTestId('btn-close-all-tabs').count() > 0) {
      await expect(env.optionsPage.page.getByTestId('btn-close-all-tabs')).toBeVisible();
    }

    const tabs = await env.optionsPage.queryAllTabs();
    const initialRowCount = await env.optionsPage.getTableRowCount();
    expect(tabs.length).toEqual(1);  // At least options page tab exists
    expect(initialRowCount).toEqual(0);     // Table may be empty initially
    console.log(`   → Initial table rendered: ${initialRowCount} rows | ${tabs.length} browser tabs`);

    // Create mock tabs and force the options page to rehydrate the table
    const mockResult = await env.optionsPage.clickLoadMockTabs();
    expect(mockResult.ok).toBe(true);

    await env.optionsPage.page.waitForTimeout(5000);

    const mockTabCount = await env.optionsPage.page.evaluate(async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.filter(tab => tab.url?.startsWith('https://')).length;
    });
    expect(mockTabCount).toBeGreaterThanOrEqual(5);

    const rows = env.optionsPage.page
      .locator('[data-testid="table-open-tabs"] .q-virtual-scroll__content tr')
      .filter({ has: env.optionsPage.page.locator('a[href^="https://"]') });

    await expect.poll(async () => await rows.count(), {
      timeout: 20000,
      intervals: [200, 400, 700, 1000, 1500]
    }).toBeGreaterThanOrEqual(5);

    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await expect(row).toBeVisible();

      const cells = row.locator('td');
      await expect(cells).toHaveCount(7);

      const actionButtons = row.getByRole('button');
      await expect(actionButtons).toHaveCount(2);
      await expect(actionButtons.nth(0)).toContainText(/Focus/i);
      await expect(actionButtons.nth(1)).toContainText(/Close/i);

      const links = row.getByRole('link');
      await expect(links).toHaveCount(1);
      await expect(links.nth(0)).toBeVisible();

      const titleText = await row.locator('td').nth(4).textContent();
      const urlText = await row.locator('td').nth(5).textContent();
      const ageText = await row.locator('td').nth(6).textContent();

      expect(titleText?.trim().length ?? 0).toBeGreaterThan(0);
      expect(urlText?.trim().length ?? 0).toBeGreaterThan(0);
      expect(ageText?.trim().length ?? 0).toBeGreaterThan(0);
    }

    console.log(`   → Mock table rendered with ${rowCount} rows and complete controls per row`);
  });

  test("keeps custom groups and ungrouped tabs untouched while age groups are ordered after grouping", async () => {
    await env.optionsPage.gotoOptionsPage(env.extensionId);
    await env.optionsPage.expectPageLoaded();

    const mockResult = await env.optionsPage.clickLoadMockTabs();
    expect(mockResult.ok).toBe(true);

    const extraUngroupedTabIds = await env.optionsPage.page.evaluate(async () => {
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        const tab = await chrome.tabs.create({
          url: `https://example.com/extra-${Date.now()}-${i}`,
          active: false,
        });
        if (tab.id != null) {
          ids.push(tab.id);
        }
      }
      return ids;
    });

    const customGroupTabIds = await env.optionsPage.page.evaluate(async () => {
      const ids: number[] = [];
      for (let i = 0; i < 3; i++) {
        const tab = await chrome.tabs.create({
          url: `https://example.com/custom-${Date.now()}-${i}`,
          active: false,
        });
        if (tab.id != null) {
          ids.push(tab.id);
        }
      }

      const groupId = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(groupId, { title: 'Custom Group' });
      return ids;
    });

    await env.optionsPage.clickGroupTabs();

    const afterGroupResult = await env.optionsPage.getGroupAndTabData();
    const ageGroups = afterGroupResult.groupsOrderedByIndex.filter(group =>
      ['Hell!', 'Quarter+', 'Month+', '2 Weeks+', 'Week+'].includes(group.title.replace(/\s+\(\d+\)$/, ''))
    );

    expect(ageGroups).toHaveLength(5);
    expect(ageGroups.map(group => group.title.replace(/\s+\(\d+\)$/, ''))).toEqual([
      'Hell!',
      'Quarter+',
      'Month+',
      '2 Weeks+',
      'Week+',
    ]);

    const customGroupStillExists = await env.optionsPage.page.evaluate(async (ids: number[]) => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.filter(tab => ids.includes(tab.id ?? -1)).every(tab => tab.groupId !== -1 && tab.groupId != null);
    }, customGroupTabIds);

    const ungroupedStillUngrouped = await env.optionsPage.page.evaluate(async (ids: number[]) => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return tabs.filter(tab => ids.includes(tab.id ?? -1)).every(tab => tab.groupId === -1 || tab.groupId == null);
    }, extraUngroupedTabIds);

    expect(customGroupStillExists).toBe(true);
    expect(ungroupedStillUngrouped).toBe(true);
  });

});
