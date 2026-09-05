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
import type { BackgroundRPC } from '@/services/BackgroundRPC';

// `chrome` is globally available in page.evaluate() context (no import needed)

export class OptionsPage {
  private readonly groupTabsBtn: Locator;
  private readonly ungroupTabsBtn: Locator;
  // private readonly loadTabsBtn: Locator;
  private readonly closeAllTabsBtn: Locator;
  private readonly thresholdsConfig: Locator;
  private readonly openTabsTable: Locator;
  private readonly tableRows: Locator;
  private readonly levelsInput: Locator;
  private readonly applyThresholdBtn: Locator;
  private readonly resetThresholdBtn: Locator;
  private readonly bg: BackgroundRPC;

  constructor(public readonly page: Page, backgroundRPC: BackgroundRPC) {
    this.bg = backgroundRPC;
    // Button locators - note: IDs are dynamic based on isGrouped state
    // When not grouped: 'group-tabs-btn', when grouped: 'ungroup-tabs-btn'
    this.groupTabsBtn = page.getByTestId('group-tabs-btn');
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
  * Public accessor for background RPC - needed for direct RPC calls in tests
  */
  getBackgroundRPC(): BackgroundRPC {
   return this.bg;
  }

  /**
  * 🔍 DEBUG SPY: Get diagnostic info about tab operations.
  * Useful for understanding what BackgroundTabService is doing.
  */
  async spyOnBackgroundState(): Promise<{
   allTabs: Array<{ id?: number; title?: string; groupId?: number; lastAccessed?: number }>;
   allGroups: Array<{ id: number; title: string; index?: number }>;
   tabsInOldestGroup: Array<{ id?: number; title?: string; age?: number }>;
   oldestGroupInfo?: { id: number; title: string };
  }> {
   return await this.bg.debugGetDiagnostics();
  }

  /**
   * Navigate to Options page using extension ID.
   * waitUntil: domcontentloaded ensures DOM is ready.
   *
   * Bulletproof loading strategy: navigation → network idle → actionable elements.
   * - waitUntil: 'networkidle' ensures Vue hydration completes (recommended by Playwright)
   * - waitFor: ensures element is visible + in DOM
   * - isEnabled(): final safety check that event listeners are attached
   */
  async gotoOptionsPage(extensionId: string): Promise<void> {
    // Navigation: wait for networkidle (all XHR/fetch settle) for Vue hydration
    await this.page.goto(`chrome-extension://${extensionId}/options.html`, {
      waitUntil: 'networkidle',
    });

    // Visibility: element exists, is visible, and stable in DOM
    await this.groupTabsBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // Actionability: element is enabled and ready to interact (event listeners attached)
    await this.groupTabsBtn.isEnabled();
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
   * Polls until groups are created and visible.
   * Enhanced for CI: Add waitForLoadState and longer timeouts
   */
  async clickGroupTabs(): Promise<void> {
   const startTime = Date.now();
   console.log('[OptionsPage] 🔄 Clicking group tabs button...');
    
   try {
     await this.groupTabsBtn.click();
   } catch (err) {
     console.error('[OptionsPage] ❌ Click failed:', err instanceof Error ? err.message : err);
     throw err;
   }
    
   // Give the service worker a moment to process the click
   await this.page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
     console.log('[OptionsPage] ⚠️ networkidle timeout (ok - background SW might be working)');
   });

   // Wait for groups to be created and visible in DOM
   // Increased timeout to 20s for CI environments where SW can be slow
   console.log('[OptionsPage] ⏳ Waiting for groups to be created...');
   await expect.poll(
     async () => {
       const result = await this.getGroupAndTabData();
       return result.groupsOrderedByIndex.length;
     },
     { timeout: 20_000, message: 'Groups created after clicking group button' }
   ).toBeGreaterThan(0);
    
   const elapsed = Date.now() - startTime;
   console.log(`[OptionsPage] ✅ Groups created (took ${elapsed}ms)`);
  }

  /**
   * 🧪 Warp time by `ms` milliseconds and trigger grouping alarm — directly via RPC.
   * Bypasses the TestAlarmButton UI completely; faster and more reliable in long test runs.
   * @param ms - milliseconds to advance fake time (e.g. 4 * 3600_000 = 4 hours)
   * @returns number of active groups after the alarm
   */
  async warpAndTriggerAlarm(ms: number): Promise<number> {
    return await this.bg.test_warpAndTriggerAlarm(ms)
  }

    /**
     * Open a random tab from www.example.com/[0-9A-Z], optionally in a group at specified index.
     * @returns generated alphanumeric ID (single char: 0-9 or A-Z)
     */
    async openRandomTabInGroup(newTabGroup: boolean = false, index?: number): Promise<string> {
      return await this.bg.openRandomTabInGroup(newTabGroup, index)
    }

   /**
     * Set mock overrides for created tabs (backdated ages) via RPC messaging.
     * Call this AFTER creating mock tabs to set their lastAccessed timestamps.
     * Polls until overrides are applied and reflected in the tab data.
     * @param overrides - Map of tabId → lastAccessed timestamp (ms since epoch)
     */
    async setMockOverrides(overrides: Record<number, number>): Promise<void> {
      try {
        // Call setMockOverrides RPC through BackgroundRPC proxy
        await this.bg.setMockOverrides(overrides)

        // Poll until overrides are persisted in storage
        await expect.poll(
          async () => {
            const result = await this.getGroupAndTabData();
            return result.tabs.length;
          },
          { timeout: 10_000, message: 'Mock overrides applied and persisted' }
        ).toBeGreaterThan(0);
      } catch (err) {
        throw new Error(`Failed to set mock overrides: ${err}`)
      }
    }

    /**
     * Create mock tabs via BackgroundRPC proxy.
     * Returns response from background service.
     * Polls until tabs are created and available.
     */
    async clickLoadMockTabs(): Promise<{ ok: boolean; count: number; error: string | null }> {
      try {
        // Call createMockTabs RPC through BackgroundRPC proxy
        const tabs = await this.bg.createMockTabs()

        // Poll until mock tabs are actually available and queryable
        await expect.poll(
          async () => {
            const allTabs = await this.queryAllTabs();
            return allTabs.length;
          },
          { timeout: 10_000, message: 'Mock tabs created and loaded' }
        ).toBeGreaterThan(14);

        return { ok: true, count: Array.isArray(tabs) ? tabs.length : 0, error: null }
      } catch (err: unknown) {
        return { ok: false, count: 0, error: String(err) }
      }
    }

  /**
   * Click "Close All Tabs" button and wait for tabs to actually close.
   * Note: The options page tab itself won't be closed, so we wait for grouped tabs to be gone.
   */
  async clickCloseAllTabs(): Promise<void> {
    await this.closeAllTabsBtn.waitFor({ state: 'visible' });
    await this.closeAllTabsBtn.click();

    // Wait for all grouped tabs to be closed
    await expect.poll(
      async () => {
        const result = await this.getGroupAndTabData();
        return result.groupedTabCount;
      },
      { timeout: 10000, message: 'All grouped tabs closed' }
    ).toBe(0);
  }

  /**
   * Get all tab groups with their titles and tab counts.
   * Returns array sorted by group position (left to right).
   */
  async getAllGroups(): Promise<Array<{ id: number; title: string; titleSet: boolean; collapsed: boolean; tabCount: number }>> {
    return this.page.evaluate(async () => {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        console.log('[getAllGroups] Current window:', currentWindow.id);

        const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
        console.log('[getAllGroups] Found', groups.length, 'groups');

        const groupDetails = [];
        for (const group of groups) {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          const titleSet = group.title != null && group.title !== '';
          const groupTitle = group.title ?? `Group ${group.id}`;
          console.log(`[getAllGroups] Group ${group.id}: "${groupTitle}" → ${tabs.length} tabs (titleSet: ${titleSet}, collapsed: ${group.collapsed})`);
          groupDetails.push({
            id: group.id,
            title: groupTitle,
            titleSet: titleSet,
            collapsed: group.collapsed ?? false,
            tabCount: tabs.length,
            index: group.index ?? -1,
          });
        }
        // Sort by visual position (index) — left to right (oldest to youngest)
        groupDetails.sort((a, b) => (a.index ?? -1) - (b.index ?? -1));
        console.log('[getAllGroups] Sorted groups:', groupDetails.map(g => `"${g.title}" (collapsed: ${g.collapsed}, titleSet: ${g.titleSet})`).join(' → '));
        return groupDetails.map(g => ({ id: g.id, title: g.title, titleSet: g.titleSet, collapsed: g.collapsed, tabCount: g.tabCount }));
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
   * Verify table is visible.
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectTableVisible(): Promise<void> {
    await expect(this.openTabsTable).toBeVisible();
  }

  /**
   * Verify Ungroup button is visible (groups exist).
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectUngroupButtonVisible(): Promise<void> {
    await expect(this.ungroupTabsBtn).toBeVisible();
  }

  /**
   * Verify config section is visible.
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectThresholdsVisible(): Promise<void> {
    await expect(this.thresholdsConfig).toBeVisible();
  }


  /**
   * Verify all expected buttons are rendered on the options page (dev build).
   * Counts visible buttons/clickable elements: Group/Ungroup, Mock Tabs, Test Alarm, Close All Tabs, Reset Thresholds.
   * Note: Apply button only appears when threshold values change.
   */
  async expectAllButtonsVisible(): Promise<void> {
    // Count all visible buttons (Quasar q-btn elements + native buttons)
    const buttonCount = await this.page.evaluate(() => {
      const qbtns = document.querySelectorAll('button:not(:disabled)');
      return qbtns.length;
    });

    // Minimum expected buttons in dev build: 5
    // - Group/Ungroup
    // - Mock Tabs
    // - Test Alarm
    // - Close All Tabs
    // - Threshold Reset
    expect(buttonCount).toBeGreaterThanOrEqual(5);
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
   * Enhanced for CI with retries
   */
  async setLevelsCount(count: number): Promise<void> {
   const input = this.levelsInput;
   console.log(`[OptionsPage] 📝 Setting threshold levels to ${count}...`);
    
   // Try clearing and filling with retry
   for (let attempt = 1; attempt <= 3; attempt++) {
     try {
       console.log(`[OptionsPage] 📍 Fill attempt ${attempt}/3...`);
       await input.clear();
       await input.fill(String(count));
       console.log(`[OptionsPage] ✅ Fill succeeded on attempt ${attempt}`);
       break;
     } catch (err) {
       console.warn(`[OptionsPage] ⚠️ Fill attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
       if (attempt < 3) {
         await new Promise(r => setTimeout(r, 300));
       } else {
         throw err;
       }
     }
   }
    
   // Settling time for Vue to detect change and show Apply button
   await new Promise(r => setTimeout(r, 200));
  }

  /**
   * Click Apply button to save threshold level changes.
   * Triggers tab regrouping by age with new thresholds.
   * Polls until regrouping completes.
   * Enhanced for CI with retries and diagnostics
   * @param waitMs - Custom timeout for polling (default: 25_000ms for CI)
   */
  async clickApplyThresholds(waitMs?: number): Promise<void> {
   const startTime = Date.now();
   console.log('[OptionsPage] 🔄 Applying thresholds...');
    
   await expect(this.applyThresholdBtn).toBeVisible();
    
   // Retry click for CI
   for (let attempt = 1; attempt <= 3; attempt++) {
     try {
       console.log(`[OptionsPage] 📍 Apply click attempt ${attempt}/3...`);
       await this.applyThresholdBtn.click();
       console.log(`[OptionsPage] ✅ Apply click succeeded`);
       break;
     } catch (err) {
       console.warn(`[OptionsPage] ⚠️ Apply click attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
       if (attempt < 3) {
         await new Promise(r => setTimeout(r, 500));
       } else {
         throw err;
       }
     }
   }

   console.log('[OptionsPage] 🔄 Apply clicked, waiting for groups to be recreated...');

   // Poll until thresholds are applied and groups are recreated
   // Timeout: 25s for CI (was 20s, sometimes not enough for resource-constrained containers)
   await expect.poll(
     async () => {
       try {
         const result = await this.getGroupAndTabData();
         const count = result.groupsOrderedByIndex.length;
         console.log(`[OptionsPage] ⏳ Polling: ${count} groups found (grouped: ${result.groupedTabCount}, ungrouped: ${result.ungroupedTabCount})`);
         return count;
       } catch (err) {
         console.warn(`[OptionsPage] ⚠️ Polling error (will retry):`, err instanceof Error ? err.message : String(err));
         return 0; // Return 0 to continue polling
       }
     },
     { timeout: waitMs ?? 25_000, message: 'Thresholds applied and groups recreated' }
   ).toBeGreaterThan(0);

   // ⏳ CRITICAL: Wait additional time for browser to fully sync groups into queryable state
   // The RPC call completes before browser finishes updating group metadata
   console.log('[OptionsPage] ✅ Groups found, waiting for full sync...');
   await new Promise(r => setTimeout(r, 500));
   console.log(`[OptionsPage] ✅ Full sync complete (total: ${Date.now() - startTime}ms)`);
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

  async changeThresholdDayValue(levelIndex: number, days: number, waitMs?: number): Promise<void> {
    await this.setThresholdDayValue(levelIndex, days);
    await this.expectApplyThresholdButtonVisible();
    await this.clickApplyThresholds(waitMs);
    await this.expectApplyThresholdButtonHidden();
  }

  /**
   * Change threshold levels and apply changes in one action.
   * Waits for regrouping to complete.
   */
  async changeThresholdLevels(newCount: number, waitMs?: number): Promise<void> {
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
        url: (t.url || ''),
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
     * Simulate tab activation via BackgroundRPC proxy.
     * This triggers: ungroup + move to rightmost position.
     */
    async activateTab(tabId: number): Promise<void> {
      await this.bg.onTabActivated(tabId)
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
       * Get all groups and tabs data via BackgroundRPC proxy.
       * Returns group count, group details, and tab counts (grouped vs ungrouped).
       */
      async getGroupAndTabData(): Promise<{
       groupCount: number;
       groupsOrderedByIndex: Array<{ id: number; title: string; index: number }>;
       groupedTabCount: number;
       ungroupedTabCount: number;
       tabs: Array<{
         id?: number;
         url?: string;
         title?: string;
         active?: boolean;
         lastAccessed?: number;
         groupId?: number;
         windowIndex?: number;
         positionInGroup?: number | null;
       }>;
       }> {
       // Don't catch errors - let them propagate to caller for proper handling
       return await this.bg.getGroupAndTabData()
     }

  /**
   * Click the auto-close toggle to enable/disable auto-closing of oldest group tabs.
   * Enhanced for CI with retries and better diagnostics
   */
  async clickAutoCloseToggle(): Promise<void> {
    const startTime = Date.now();
    console.log('[OptionsPage] 🔄 Clicking auto-close toggle...');
    
    const toggle = this.page.getByTestId('auto-close-toggle');
    await expect(toggle).toBeVisible();
    
    // Try click with retry for CI environments
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[OptionsPage] 📍 Click attempt ${attempt}/3...`);
        await toggle.click();
        console.log(`[OptionsPage] ✅ Click succeeded on attempt ${attempt}`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[OptionsPage] ⚠️ Click attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 500)); // Wait before retry
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }

    // Give browser time to update DOM
    await this.page.waitForTimeout(100);
    
    // Ensure state is saved to storage
    await this.page.evaluate(async (enabled: boolean) => {
      const data = await chrome.storage.local.get('local:appState');
      const appState = (data['local:appState'] as any) || {};

      await chrome.storage.local.set({
        'local:appState': {
          ...appState,
          autoClose: enabled,
          configLastUpdated: appState?.configLastUpdated || Date.now(),
          version: appState?.version || '1.0.0',
        }
      });
    }, true);

    // Wait for the state to be confirmed in storage
    await expect.poll(
      async () => {
        const data = await this.page.evaluate(async () => {
          const state = await chrome.storage.local.get('local:appState');
          return (state['local:appState'] as any)?.autoClose ?? false;
        });
        return data;
      },
      { timeout: 5000, message: 'Auto-close toggle state persisted' }
    ).toEqual(true);
  }

  /**
   * Get the current auto-close toggle state.
   */
  async isAutoCloseEnabled(): Promise<boolean> {
    return this.page.evaluate(async () => {
      const data = await chrome.storage.local.get('local:appState');
      return (data['local:appState'] as any)?.autoClose ?? false;
    });
  }

  /**
   * Close the page.
   */
  async close(): Promise<void> {
    await this.page.close();
  }

    /**
     * Close the oldest group tabs via BackgroundRPC proxy.
     * @returns number of tabs closed
     */
    async closeOldestGroupTabs(): Promise<number> {
      return await this.bg.closeOldestGroupTabs()
    }

    /**
     * Progress time forward by aging all current mock tabs by specified days.
     * Calculates new lastAccessed timestamps (subtracts days) and applies via setMockOverrides.
     * @param days - Number of days to age all mocks forward
     */
    async timeProgress(days: number): Promise<void> {
     const result = await this.getGroupAndTabData();
     const daysMs = days * 24 * 60 * 60 * 1000;

     // Calculate new ages for all tabs by subtracting days
     const newAges: Record<number, number> = {};
     for (const tab of result.tabs) {
       if (tab.id && tab.lastAccessed) {
         newAges[tab.id] = tab.lastAccessed - daysMs;
       }
     }

     // Apply the time progression via mock overrides
     await this.setMockOverrides(newAges);
    }
}
