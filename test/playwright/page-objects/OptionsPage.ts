/**
 * OptionsPage — Page Object Model for Extension Options page.
 *
 * Encapsulates all interactions with the Options UI:
 * - Button clicks (group, ungroup, load tabs)
 * - Table queries (row count, verify data)
 * - Element visibility checks
 * - Configuration state checks
 *
 * Usage:
 *   const options = new OptionsPage(page);
 *   await options.goto(extensionId);
 *   await options.clickGroupTabs();
 *   const rowCount = await options.getTableRowCount();
 */

import { expect, type Locator, type Page } from '@playwright/test';

// Import constants using relative path (not bundled through Vite like app code)
const MOCK_TABS_ACTION = 'createMockTabs';
const ON_TAB_ACTIVATED_ACTION = 'onTabActivated';

export class OptionsPage {
  private readonly groupTabsBtn: Locator;
  private readonly ungroupTabsBtn: Locator;
  private readonly loadTabsBtn: Locator;
  private readonly closeAllTabsBtn: Locator;
  private readonly thresholdsConfig: Locator;
  private readonly openTabsTable: Locator;
  private readonly tableRows: Locator;

  constructor(public readonly page: Page) {
    // Button locators
    this.groupTabsBtn = page.getByTestId('popup-btn-group-tabs');
    this.ungroupTabsBtn = page.getByTestId('popup-btn-ungroup-tabs');
    this.loadTabsBtn = page.getByTestId('btn-load-tabs');
    this.closeAllTabsBtn = page.getByTestId('btn-close-all-tabs');

    // Container locators
    this.thresholdsConfig = page.getByTestId('thresholds-config');
    this.openTabsTable = page.getByTestId('table-open-tabs');

    // Table row locators
    this.tableRows = page.locator('[data-testid="table-open-tabs"] tr');
  }

  /**
   * Navigate to Options page using extension ID.
   * waitUntil: domcontentloaded ensures DOM is ready.
   */
  async goto(extensionId: string): Promise<void> {
    await this.page.goto(`chrome-extension://${extensionId}/options.html`, {
      waitUntil: 'domcontentloaded',
    });
  }

  /**
   * Verify Options page is fully loaded with all main components visible.
   */
  async expectPageLoaded(): Promise<void> {
    await Promise.all([
      expect(this.groupTabsBtn).toBeVisible({ timeout: 4000 }),
      expect(this.ungroupTabsBtn).not.toBeVisible({ timeout: 2000 }),
      expect(this.thresholdsConfig).toBeVisible({ timeout: 4000 }),
    ]);
  }

  /**
   * Click "Group Tabs by Age" button and wait for grouping to complete.
   * Optional: pass timeout override (default 1200ms).
   */
  async clickGroupTabs(waitMs: number = 1200): Promise<void> {
    await this.groupTabsBtn.click();
    await this.page.waitForTimeout(waitMs);
  }

  /**
   * Click "Ungroup All Tabs" button and wait for ungrouping to complete.
   * Optional: pass timeout override (default 1000ms).
   */
  async clickUngroupTabs(waitMs: number = 1000): Promise<void> {
    await this.ungroupTabsBtn.click();
    await this.page.waitForTimeout(waitMs);
  }

  /**
   * Click "Load/Create Mock Tabs" button.
   * Returns response from background service worker.
   * Includes wait time for tabs to load with URLs.
   */
  async clickLoadMockTabs(waitMs: number = 500): Promise<{ ok: boolean; count: number; error: string | null }> {
    const result = await this.page.evaluate((actionName: string) => {
      return new Promise<{ ok: boolean; count: number; error: string | null }>((resolve) => {
        try {
          chrome.runtime.sendMessage({ action: actionName }, (r: any) => {
            resolve({ ok: true, count: r?.tabs?.length ?? 0, error: r?.error ?? null });
          });
        } catch (e: unknown) {
          resolve({ ok: false, count: 0, error: String(e) });
        }
      });
    }, MOCK_TABS_ACTION);
    // Wait for tabs to load with URLs
    await this.page.waitForTimeout(waitMs);
    return result as { ok: boolean; count: number; error: string | null };
  }

  /**
   * Click "Close All Tabs" button.
   */
  async clickCloseAllTabs(): Promise<void> {
    await this.closeAllTabsBtn.click();
  }

  /**
   * Get count of table rows (excluding header).
   */
  async getTableRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  /**
   * Verify table has exactly N rows.
   */
  async expectTableRowsEqual(expectedRows: number): Promise<void> {
    const count = await this.getTableRowCount();
    expect(count).toBe(expectedRows);
  }

  /**
   * Verify table is visible.
   */
  async expectTableVisible(): Promise<void> {
    await expect(this.openTabsTable).toBeVisible({ timeout: 3000 });
  }

  /**
   * Verify first table row is visible.
   */
  async expectFirstRowVisible(): Promise<void> {
    await expect(this.openTabsTable.locator('tr').first()).toBeVisible({ timeout: 3000 });
  }

  /**
   * Verify Group button is visible (no groups exist).
   */
  async expectGroupButtonVisible(): Promise<void> {
    await expect(this.groupTabsBtn).toBeVisible({ timeout: 3000 });
  }

  /**
   * Verify Ungroup button is visible (groups exist).
   */
  async expectUngroupButtonVisible(): Promise<void> {
    await expect(this.ungroupTabsBtn).toBeVisible({ timeout: 3000 });
  }

  /**
   * Verify Ungroup button is NOT visible (no groups exist).
   */
  async expectUngroupButtonHidden(): Promise<void> {
    await expect(this.ungroupTabsBtn).not.toBeVisible({ timeout: 2000 });
  }


  /**
   * Verify config section is visible.
   */
  async expectThresholdsVisible(): Promise<void> {
    await expect(this.thresholdsConfig).toBeVisible({ timeout: 3000 });
  }

  /**
   * Get all tabs from current browser window.
   * Returns array: { id, url, groupId }
   */
  async queryAllTabs(): Promise<Array<{ id?: number; url: string; groupId?: number }>> {
    return this.page.evaluate(async () => {
      const raw = await chrome.tabs.query({ currentWindow: true });
      return (raw || []).map((t: any) => ({
        id: t.id,
        url: (t.url || '').slice(0, 40),
        groupId: t.groupId ?? -1,
      }));
    });
  }

  /**
   * Get grouped tabs only.
   */
  async getGroupedTabs(): Promise<Array<{ id?: number; url: string; groupId?: number }>> {
    const all = await this.queryAllTabs();
    return all.filter(t => t.groupId !== -1 && t.groupId !== undefined);
  }

  /**
   * Get ungrouped tabs only.
   */
  async getUngroupedTabs(): Promise<Array<{ id?: number; url: string; groupId?: number }>> {
    const all = await this.queryAllTabs();
    return all.filter(t => t.groupId === -1 || t.groupId === undefined);
  }

  /**
   * Get number of unique groups.
   */
  async getGroupCount(): Promise<number> {
    const grouped = await this.getGroupedTabs();
    const groupIds = new Set(grouped.map(t => t.groupId));
    return groupIds.size;
  }

  /**
   * Verify exactly N groups exist.
   */
  async expectGroupCountEqual(expectedCount: number): Promise<void> {
    const count = await this.getGroupCount();
    expect(count).toBe(expectedCount);
  }

  /**
   * Simulate tab activation via message to background service worker.
   * This triggers: ungroup + move to rightmost position.
   */
  async activateTab(tabId: number): Promise<void> {
    await this.page.evaluate(({ id, actionName }: { id: number; actionName: string }) => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ action: actionName, tabId: id }, () => resolve());
      });
    }, { id: tabId, actionName: ON_TAB_ACTIVATED_ACTION });
  }

  /**
   * Wait for a specific tab to be ungrouped and moved to rightmost.
   * Useful after activating a tab in a group.
   */
  async waitForTabActivated(tabId: number, timeoutMs: number = 5000): Promise<void> {
    await this.page.waitForFunction(
      (id: number) => {
        return chrome.tabs.query({ currentWindow: true }).then((allTabs: any[]) => {
          const tab = allTabs.find(t => t.id === id);
          const isUngrouped = tab && (tab.groupId === -1 || tab.groupId === undefined || tab.groupId === null);
          const isRightmost = tab && allTabs[allTabs.length - 1].id === id;
          return isUngrouped && isRightmost;
        });
      },
      tabId,
      { timeout: timeoutMs, polling: 300 }
    );
  }

  /**
   * Close the page.
   */
  async close(): Promise<void> {
    await this.page.close();
  }

  /**
   * Setup service worker console logging for debugging.
   * Captures all console messages from background service worker.
   * Usage: Call this in beforeAll hook to monitor SW execution.
   */
  static setupServiceWorkerLogging(context: any): void {
    const workers = context.serviceWorkers();
    if (workers.length === 0) {
      console.warn('[Test] No service workers found');
      return;
    }

    const sw = workers[0];
    sw.on('console', (msg: any) => {
      const type = msg.type();
      const text = msg.text();
      const prefix = type === 'error' ? '❌ [SW_ERROR]' : '✓ [SW_LOG]';
      console.log(`${prefix}: ${text}`);
    });

    console.log('[Test] Service worker logging enabled');
  }
}
