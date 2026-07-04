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
  private readonly sortTabsBtn: Locator;
  // private readonly loadTabsBtn: Locator;
  private readonly closeAllTabsBtn: Locator;
  private readonly thresholdsConfig: Locator;
  private readonly openTabsTable: Locator;
  private readonly tableRows: Locator;
  private readonly levelsInput: Locator;
  private readonly applyThresholdBtn: Locator;
  private readonly resetThresholdBtn: Locator;

  constructor(public readonly page: Page) {
    // Button locators - note: IDs are dynamic based on isGrouped state
    // When not grouped: 'group-tabs-btn', when grouped: 'ungroup-tabs-btn'
    this.groupTabsBtn = page.getByTestId('group-tabs-btn');
    this.sortTabsBtn = page.getByTestId('sort-tabs-by-domain');
    this.ungroupTabsBtn = page.getByTestId('ungroup-tabs-btn');
    // this.loadTabsBtn = page.getByTestId('btn-load-tabs');
    this.closeAllTabsBtn = page.getByTestId('btn-close-all-tabs');

    // Container locators
    this.thresholdsConfig = page.getByTestId('thresholds-config');
    this.openTabsTable = page.getByTestId('table-open-tabs');

    // Thresholds control locators
    this.levelsInput = page.getByTestId('thresholds-levels-input');
    this.applyThresholdBtn = page.getByTestId('threshold-apply');
    this.resetThresholdBtn = page.getByTestId('threshold-reset');

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
    // Wait for Vue to hydrate and render dynamic elements
    await this.page.waitForLoadState('networkidle');
    await this.expectPageLoaded();
  }

  /**
   * Verify Options page is fully loaded with all main components visible.
   * Waits for Vue hydration, then verifies key elements are visible.
   * Uses global Playwright timeout (10000ms from config).
   *
   * NOTE: thresholds-config is only rendered in dev builds (isDevEnv flag).
   * In production builds, only checks for group-tabs-btn.
   */
  async expectPageLoaded(): Promise<void> {
    // Wait for Vue to hydrate completely - element must exist in DOM with data-testid
    await this.page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="group-tabs-btn"]');
      return btn !== null;
    }, { timeout: 10000 });

    // Now verify visibility
    await expect(this.groupTabsBtn).toBeVisible();
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
    * Group Tabs by Domain via background message (no UI button).
    * Uses chrome.runtime.sendMessage to trigger sortTabsByDomain.
    * Optional: pass timeout override (default 1500ms).
    */
   async clicksortTabsByDomain(waitMs: number = 1500): Promise<{ groupsCreated: number; error: string | null }> {
     const result = await this.page.evaluate(() => {
       return new Promise<{ groupsCreated: number; error: string | null }>((resolve) => {
         try {
           chrome.runtime.sendMessage({ action: 'sortTabsByDomain' }, (r: any) => {
             resolve({ groupsCreated: r?.groupsCreated ?? 0, error: r?.error ?? null });
           });
         } catch (e: unknown) {
           resolve({ groupsCreated: 0, error: String(e) });
         }
       });
     });
     await this.page.waitForTimeout(waitMs);
     return result;
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
   * Click "Ungroup All Tabs" button and wait for ungrouping to complete.
   * Optional: pass timeout override (default 1000ms).
   */
  async clickSortTabs(waitMs: number = 1000): Promise<void> {
    await this.sortTabsBtn.click();
    await this.page.waitForTimeout(waitMs);

  }

  /**
   * Set mock overrides for created tabs (backdated ages).
   * Call this AFTER creating mock tabs to set their lastAccessed timestamps.
   * @param overrides - Map of tabId → lastAccessed timestamp (ms since epoch)
   */
  async setMockOverrides(overrides: Record<number, number>): Promise<void> {
    const result = await this.page.evaluate((data: Record<string, number>) => {
      return new Promise<{ error: string | null }>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'setMockOverrides', overrides: data },
          (response: any) => {
            resolve(response || { error: 'No response' });
          }
        );
      });
    }, overrides);

    if (result.error) {
      throw new Error(`Failed to set mock overrides: ${result.error}`);
    }

    // Extra wait to ensure storage is persisted
    await this.page.waitForTimeout(500);
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
    // await this.closeAllTabsBtn.waitFor({ state: 'visible' });
    await this.closeAllTabsBtn.click();
  }

  /**
   * Get all tab groups with their titles and tab counts.
   * Returns array sorted by group position (left to right).
   */
  async getAllGroups(): Promise<Array<{ id: number; title: string; tabCount: number }>> {
    return this.page.evaluate(async () => {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        console.log('[getAllGroups] Current window:', currentWindow.id);

        const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
        console.log('[getAllGroups] Found', groups.length, 'groups');

        const groupDetails = [];
        for (const group of groups) {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          console.log(`[getAllGroups] Group ${group.id}: "${group.title}" → ${tabs.length} tabs`);
          groupDetails.push({
            id: group.id,
            title: group.title,
            tabCount: tabs.length,
          });
        }
        return groupDetails;
      } catch (err) {
        console.error('[getAllGroups] Error:', err);
        return [];
      }
    });
  }

  /**
   * Get ungrouped tabs count.
   */
  async getUngroupedTabCount(): Promise<number> {
    const all = await this.queryAllTabs();
    return all.filter(t => t.groupId === -1).length;
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
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectTableVisible(): Promise<void> {
    await expect(this.openTabsTable).toBeVisible();
  }

  /**
   * Verify first table row is visible.
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectFirstRowVisible(): Promise<void> {
    await expect(this.openTabsTable.locator('tr').first()).toBeVisible();
  }

  /**
   * Verify Group button is visible (no groups exist).
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectGroupButtonVisible(): Promise<void> {
    await expect(this.groupTabsBtn).toBeVisible();
  }

  /**
   * Verify Ungroup button is visible (groups exist).
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectUngroupButtonVisible(): Promise<void> {
    await expect(this.ungroupTabsBtn).toBeVisible();
  }

  /**
   * Verify Ungroup button is NOT visible (no groups exist).
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectUngroupButtonHidden(): Promise<void> {
    await expect(this.ungroupTabsBtn).not.toBeVisible();
  }


  /**
   * Verify config section is visible.
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectThresholdsVisible(): Promise<void> {
    await expect(this.thresholdsConfig).toBeVisible();
  }

  /**
   * Get current threshold levels count from input.
   */
  async getLevelsCount(): Promise<number> {
    const value = await this.levelsInput.inputValue();
    return parseInt(value, 10);
  }

  /**
   * Set threshold levels count via input field.
   * Changes are tracked locally but not persisted until Apply is clicked.
   */
  async setLevelsCount(count: number): Promise<void> {
    await this.levelsInput.clear();
    await this.levelsInput.fill(String(count));
  }

  /**
   * Click Apply button to save threshold level changes.
   * Triggers tab regrouping by age with new thresholds.
   * Optional: pass timeout override (default 1500ms for regroup completion).
   */
  async clickApplyThresholds(waitMs: number = 1500): Promise<void> {
    await expect(this.applyThresholdBtn).toBeVisible();
    await this.applyThresholdBtn.click();
    await this.page.waitForTimeout(waitMs);
  }

  /**
   * Click Reset button to revert thresholds to defaults.
   */
  async clickResetThresholds(): Promise<void> {
    await this.resetThresholdBtn.click();
  }

  /**
   * Verify threshold levels input has specific value.
   */
  async expectLevelsCountEqual(expectedCount: number): Promise<void> {
    const count = await this.getLevelsCount();
    expect(count).toBe(expectedCount);
  }

  /**
   * Verify Apply button is visible (changes detected).
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectApplyThresholdButtonVisible(): Promise<void> {
    await expect(this.applyThresholdBtn).toBeVisible();
  }

  /**
   * Verify Apply button is NOT visible (no changes).
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectApplyThresholdButtonHidden(): Promise<void> {
    await expect(this.applyThresholdBtn).not.toBeVisible();
  }

  /**
   * Set the day value for a specific threshold level input.
   * @param levelIndex - Index in the active thresholds list (0=Week+, 1=2 Weeks+, etc.)
   * @param days - New day threshold value
   */
  async setThresholdDayValue(levelIndex: number, days: number): Promise<void> {
    const input = this.page.getByTestId(`threshold-${levelIndex}`);
    await input.clear();
    await input.fill(String(days));
  }

  /**
   * Change threshold day value and apply in one action.
   * Waits for regrouping to complete.
   */

  async changeThresholdDayValue(levelIndex: number, days: number, waitMs: number = 1500): Promise<void> {
    await this.setThresholdDayValue(levelIndex, days);
    await this.expectApplyThresholdButtonVisible();
    await this.clickApplyThresholds(waitMs);
    await this.expectApplyThresholdButtonHidden();
  }

  /**
   * Change threshold levels and apply changes in one action.
   * Waits for regrouping to complete.
   */
  async changeThresholdLevels(newCount: number, waitMs: number = 1500): Promise<void> {
    await this.setLevelsCount(newCount);
    await this.expectApplyThresholdButtonVisible();
    await this.clickApplyThresholds(waitMs);
    await this.expectApplyThresholdButtonHidden();
  }

  /**
   * Get all tabs from current browser window.
   * Optionally waits for all tabs to finish loading (status === 'complete') via polling.
   * Polling co 200ms jest szybsze niż fixed timeout – od razu zwraca gdy wszystkie gotowe.
   * @param waitForLoad - If true, polls until all tabs have status 'complete' (timeout: 5000ms)
   */
  async queryAllTabs(waitForLoad: boolean = false): Promise<Array<{ id?: number; url: string; groupId?: number }>> {
    if (waitForLoad) {
      await this.page.waitForFunction(() => {
        return chrome.tabs.query({ currentWindow: true }).then((tabs: any[]) => {
          return tabs.length > 0 && tabs.every((t: any) => t.status === 'complete');
        });
      }, { timeout: 5000, polling: 200 });
    }

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
     * Get all groups and tabs data.
     * Returns group count, group details, and tab counts (grouped vs ungrouped).
     * Applies mock overrides to lastAccessed timestamps if they exist.
     * Prints each tab: index, id, groupId, title, url
     */
    async getGroupAndTabData(): Promise<{
     groupCount: number;
     groups: Array<{ id: number; title: string }>;
     groupedTabCount: number;
     ungroupedTabCount: number;
     tabs: Array<{
       id?: number;
       url?: string;
       title?: string;
       active?: boolean;
       lastAccessed?: number;
       groupId?: number;
       index?: number;
     }>;
    }> {
     return await this.page.evaluate(async () => {
       // Fetch mock overrides
       const mockOverrides = await new Promise<Record<number, number>>((resolve) => {
         chrome.runtime.sendMessage({ action: 'getMockOverrides' }, (response: any) => {
           resolve(response?.overrides || {});
         });
       });

       const groups = await (chrome.tabGroups as any).query({ windowId: (chrome.windows as any).WINDOW_ID_CURRENT })
       const tabs = await (chrome.tabs as any).query({ currentWindow: true })

       // Apply mock overrides to tabs
       for (const tab of tabs) {
         if (tab.id != null) {
           const numericOverride = (mockOverrides as Record<number, number>)[tab.id]
           const stringOverride = (mockOverrides as Record<string, number>)[String(tab.id)]
           const override = numericOverride ?? stringOverride
           if (override != null) {
             tab.lastAccessed = override
           }
         }
       }

       return {
         groupCount: groups.length,
         groups: groups.map((g: any) => ({
           id: g.id,
           title: g.title
         })),
         groupedTabCount: tabs.filter((t: any) => t.groupId != null && t.groupId !== -1).length,
         ungroupedTabCount: tabs.filter((t: any) => t.groupId == null || t.groupId === -1).length,
         tabs: tabs.map((t: any) => ({
           id: t.id,
           url: t.url,
           title: t.title,
           active: t.active,
           lastAccessed: t.lastAccessed,
           groupId: t.groupId,
           index: t.index
         }))
       }
     })
    }

  /**
   * Click "Backup Tabs" button to save current tabs.
   */
  async clickBackupTabs(): Promise<void> {
    await this.page.getByTestId('backup-btn').click();
  }

  /**
   * Click "Restore Tabs" button.
   */
  async clickRestoreTabs(): Promise<void> {
    await this.page.getByTestId('restore-btn').click();
  }

  /**
   * Get backed-up tabs from browser storage.
   * @returns Array of backed-up tab URLs, or null if no backup exists
   */
  async getBackupFromStorage(): Promise<Array<{ url?: string; title?: string }> | null> {
    return this.page.evaluate(async () => {
      const data = await chrome.storage.local.get('archivum:tab_backup');
      const backup = data['archivum:tab_backup'];
      return backup?.tabs || null;
    });
  }

  /**
   * Verify that backup button is visible (no backup exists).
   */
  async expectBackupButtonVisible(): Promise<void> {
    await expect(this.page.getByTestId('backup-btn')).toBeVisible();
  }

  /**
   * Verify that restore button is visible (backup exists).
   */
  async expectRestoreButtonVisible(): Promise<void> {
    await expect(this.page.getByTestId('restore-btn')).toBeVisible();
  }

  /**
   * Verify that restore button is NOT visible (no backup exists).
   */
  async expectRestoreButtonHidden(): Promise<void> {
    await expect(this.page.getByTestId('restore-btn')).not.toBeVisible();
  }

  /**
   * Confirm the restore dialog by clicking the "Restore" button in the confirmation popup.
   * Uses data-testid="restore-confirm" to target the dialog's Restore button specifically.
   */
  async confirmRestore(): Promise<void> {
    // Click the restore-confirm button inside the dialog
    await this.page.getByTestId('restore-confirm').click();
    // Wait for restore operation to complete
    await this.page.waitForTimeout(2000);
  }

  /**
   * Click "Delete/Clear Backup" button to remove the backup.
   */
  async clickDeleteBackup(): Promise<void> {
    await this.page.getByTestId('clear-backup-btn').click();
  }

  /**
   * Verify that delete backup button is visible (backup exists).
   */
  async expectDeleteBackupButtonVisible(): Promise<void> {
    await expect(this.page.getByTestId('clear-backup-btn')).toBeVisible();
  }

  /**
   * Verify that delete backup button is NOT visible (no backup exists).
   */
  async expectDeleteBackupButtonHidden(): Promise<void> {
    await expect(this.page.getByTestId('clear-backup-btn')).not.toBeVisible();
  }

  /**
   * Close the page.
   */
  async close(): Promise<void> {
    await this.page.close();
  }
}
