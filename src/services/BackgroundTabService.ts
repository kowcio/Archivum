/**
 * BackgroundTabService — tab operations for the background service worker.
 *
 * Runs WITHOUT Pinia, WITHOUT storing tabs to browser.storage.
 * Reads config thresholds from configStorage, operates directly on browser.tabs APIs.
 * Tabs are queried live — no cached snapshot.
 *
 * CROSS-BROWSER SUPPORT:
 *   ✅ Chrome/Edge: Full tab grouping + ungrouping via browser.tabGroups API
 *   ✅ Firefox: No tabGroups API, gracefully skips grouping moves
 *   ✅ All browsers: Tab activation → ungroup + move to rightmost
 *
 * Flow:
 *   browser.alarms → groupTabsByAge()
 *   browser.tabs.onActivated → onTabActivated()
 *   UI message → groupTabsByAge() / ungroupAllTabs()
 */

import {TabRow} from '@/entrypoints/options/models/TabRow.ts'
import {AgeClassification} from '@/models/AgeClassification.ts'
import {StorageRepository} from '@/store'
import {AppThresholds} from '@/models/AppThresholds'
import type {Browser} from 'wxt/browser'
import {browser} from 'wxt/browser'
import {MOCK_TABS} from '@/utils/mockTabData'
import {APP_DEFAULTS} from '@/constants'
import {getCurrentTime} from '@/utils/testTime'

type PluginGroup = {
  id: number;
  title: string;
  index?: number;
  color?: string;
  collapsed?: boolean
}

type AgeGroupingPlan = {
  activeLevels: Array<{ label: string; color: string }>;
  levelTabIds: number[][];
  freshTabIds: number[];
  tabById: Map<number, Browser.tabs.Tab>;
  targetLabelByTabId: Map<number, string | null>;
}

export class BackgroundTabService {
  /**
   * Get array of possible plugin-created group titles based on threshold labels.
   * Titles follow pattern: "Label+ (count)"
   */
  private static getPluginGroupTitles(): string[] {
    return APP_DEFAULTS.THRESHOLDS.presets.map(p => p.label)
  }

  /**
   * Query ONLY plugin-created groups from current window.
   * Returns groups sorted by visual position (index).
   *
   * Returns:
   * - Empty array if tabGroups API not available
   * - Only groups with titles starting with threshold labels (user groups excluded)
   * - Sorted by index (leftmost to rightmost)
   *
   * This centralizes group querying to reduce workload — only one query per operation.
   * Replaces 6+ duplicated query patterns across the plugin.
   * @ param getAll - true - return all groups, false (default) - return only the groups from the plugin
   */
  static async getGroups(getAll: boolean = false): Promise<Array<{
    id: number;
    title: string;
    index?: number;
    color?: string;
    collapsed?: boolean
  }>> {
    try {
      if (browser.tabGroups == null) return []

      const allGroups = await (browser.tabGroups as any)
        .query({windowId: (browser.windows as any).WINDOW_ID_CURRENT})
      // ✅ Safety filter: remove groups without id (shouldn't happen but defensive)

      const validGroups = allGroups.filter((g: any) => g.id != null)
      validGroups.sort((a: any, b: any) => (a.index ?? -1) - (b.index ?? -1))

      //return all the groups i.ex to check logic in tests
      if (getAll) return validGroups

      // Filter: keep only plugin-created groups
      return validGroups.filter((group: any) => this.getGroupLabel(group.title) != null)
    } catch (err) {
      console.warn('[BackgroundTabService] ⚠️ Failed to query plugin groups:', err)
      return []
    }
  }

  static async getThresholds(): Promise<AppThresholds> {
    return await StorageRepository.getStorageThresholds()
  }

  /**
   * Single source of truth for "is this a plugin-created group?".
   * Returns the threshold label the group title starts with (e.g. "Week+ (3)" → "Week+"),
   * or null for user-created / untitled groups.
   */
  private static getGroupLabel(groupTitle: string | undefined): string | null {
    if (!groupTitle) return null
    return this.getPluginGroupTitles().find(label => groupTitle.startsWith(label)) ?? null
  }

  private static createGroupMaps(groups: PluginGroup[]): {
    labelByGroupId: Map<number, string>;
    groupByLabel: Map<string, PluginGroup>;
  } {
    const labelByGroupId = new Map<number, string>()
    const groupByLabel = new Map<string, PluginGroup>()

    for (const group of groups) {
      const label = this.getGroupLabel(group.title)
      if (!label) continue

      labelByGroupId.set(group.id, label)
      if (!groupByLabel.has(label)) {
        groupByLabel.set(label, group)
      }
    }

    return { labelByGroupId, groupByLabel }
  }

  private static buildAgeGroupingPlan(
    rawTabs: Browser.tabs.Tab[],
    thresholds: AppThresholds,
    currentTime: number
  ): AgeGroupingPlan {
    const rows = TabRow.fromTabs(rawTabs, thresholds, currentTime)
    const activeThresholdLevels = thresholds.activeThresholdLevels()
    const activeLevels = activeThresholdLevels.map(level => ({
      label: level.label,
      color: level.color as string,
    }))
    const levelTabIds: number[][] = Array.from({length: activeLevels.length}, () => [])
    const freshTabIds: number[] = []
    const ageMap = new Map<number, number>()
    const targetLabelByTabId = new Map<number, string | null>()
    const tabById = new Map<number, Browser.tabs.Tab>()

    for (const tab of rawTabs) {
      if (tab.id != null) {
        tabById.set(tab.id, tab)
      }
    }

    for (const row of rows) {
      if (row.id != null) {
        ageMap.set(row.id, row.lastAccessDays ?? 0)
      }
    }

    for (const row of rows) {
      if (row.id == null) continue

      const ageClassification = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)

      if (ageClassification.index === 0) {
        freshTabIds.push(row.id)
        targetLabelByTabId.set(row.id, null)
        continue
      }

      const levelIndex = ageClassification.index - 1
      if (levelIndex >= 0 && levelIndex < activeLevels.length) {
        levelTabIds[levelIndex].push(row.id)
        targetLabelByTabId.set(row.id, activeLevels[levelIndex].label)
      }
    }

    for (const ids of levelTabIds) {
      ids.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
    }

    return { activeLevels, levelTabIds, freshTabIds, tabById, targetLabelByTabId }
  }

  private static async reorderTabsForStableAgeLayout(plan: AgeGroupingPlan): Promise<void> {
    let insertIndex = 0

    for (let i = plan.activeLevels.length - 1; i >= 0; i--) {
      const tabIds = plan.levelTabIds[i]
      if (tabIds.length === 0) continue

      try {
        await browser.tabs.move(tabIds, { index: insertIndex })
        insertIndex += tabIds.length
      } catch (err) {
        console.error('[BackgroundTabService] ⚠️ Age-bucket reorder failed, skipping:', err)
      }
    }

    if (plan.freshTabIds.length > 0) {
      try {
        await browser.tabs.move(plan.freshTabIds, { index: -1 })
      } catch (err) {
        console.error('[BackgroundTabService] ⚠️ Fresh-tab reorder failed, skipping:', err)
      }
    }
  }

  /**
   * Single place that writes a plugin group's title as "<Label> (<tab count>)".
   * Skips empty groups — the browser removes a group by itself once its last tab leaves.
   * @param extra - additional tabGroups.update() fields (e.g. color, collapsed)
   */
  private static async refreshGroupTitle(groupId: number, label: string, extra: Record<string, unknown> = {}): Promise<void> {
    try {
      const count = (await browser.tabs.query({ groupId })).length
      if (count === 0) return
      await (browser.tabGroups as any).update(groupId, { title: `${label} (${count})`, ...extra })
    } catch (err) {
      // Group can disappear between query and update (last tab closed/moved) — nothing to fix then.
      console.warn(`[BackgroundTabService] ⚠️ Failed to refresh title of group "${label}":`, err)
    }
  }

  private static async groupExists(groupId: number): Promise<boolean> {
    try {
      await (browser.tabGroups as any).get(groupId)
      return true
    } catch {
      return false
    }
  }

  /**
   * Physically place plugin groups left→right from oldest to youngest level.
   * Moving individual tabs is not enough: tabs.group() may drop a NEW group to the
   * right of an existing one (a group can't be split), leaving e.g. "Month+" before "Hell!".
   */
  private static async orderGroupsOldestFirst(
    plan: AgeGroupingPlan,
    groupByLabel: Map<string, PluginGroup>
  ): Promise<void> {
    // Groups can't sit among pinned tabs — start right after them.
    let insertIndex = (await browser.tabs.query({ currentWindow: true, pinned: true })).length

    for (let i = plan.activeLevels.length - 1; i >= 0; i--) {
      const group = groupByLabel.get(plan.activeLevels[i].label)
      if (group?.id == null || !(await this.groupExists(group.id))) continue
      try {
        await (browser.tabGroups as any).move(group.id, { index: insertIndex })
        insertIndex += (await browser.tabs.query({ groupId: group.id })).length
      } catch (err) {
        console.warn(`[BackgroundTabService] ⚠️ Failed to order group "${plan.activeLevels[i].label}":`, err)
      }
    }
  }

  private static async applyAgeGrouping(options: { reorderTabs: boolean }): Promise<{
    groupsCreated: number;
    tabsMoved: number;
  }> {
    if (browser.tabGroups == null) {
      return { groupsCreated: 0, tabsMoved: 0 }
    }

    const rawTabs = await this.getTabs()
    const thresholds = await this.getThresholds()
    const currentTime = await getCurrentTime()
    const plan = this.buildAgeGroupingPlan(rawTabs, thresholds, currentTime)
    const groups = await this.getGroups()
    const groupMaps = this.createGroupMaps(groups)

    let tabsMoved = 0

    for (const [tabId, targetLabel] of plan.targetLabelByTabId) {
      const tab = plan.tabById.get(tabId)
      if (tab == null) continue

      let currentLabel: string | null = null
      if (tab.groupId != null && tab.groupId !== -1) {
        currentLabel = groupMaps.labelByGroupId.get(tab.groupId) ?? null
      }

      if (currentLabel !== targetLabel) {
        tabsMoved++
      }
    }

    if (options.reorderTabs) {
      await this.reorderTabsForStableAgeLayout(plan)
    }

    const freshGroupedIds = plan.freshTabIds.filter((tabId) => {
      const tab = plan.tabById.get(tabId)
      return tab != null && tab.groupId != null && tab.groupId !== -1
    })
    if (freshGroupedIds.length > 0) {
      try {
        await (browser.tabs as any).ungroup(freshGroupedIds)
      } catch (err) {
        console.warn('[BackgroundTabService] ⚠️ Failed to ungroup fresh tabs:', err)
      }
    }

    let groupsCreated = 0
    for (let i = plan.activeLevels.length - 1; i >= 0; i--) {
      const level = plan.activeLevels[i]
      const tabIds = plan.levelTabIds[i]
      if (tabIds.length === 0) continue

      // ⚠️ The group snapshot was taken BEFORE tabs were moved. If an older level just
      // pulled every tab out of this group, the browser auto-deleted it and its id is stale.
      const existingGroup = groupMaps.groupByLabel.get(level.label)
      const existingAlive = existingGroup?.id != null && await this.groupExists(existingGroup.id)

      if (existingAlive) {
        const toMove = tabIds.filter((tabId) => plan.tabById.get(tabId)?.groupId !== existingGroup!.id)
        if (toMove.length > 0) {
          try {
            await (browser.tabs as any).group({ tabIds: toMove, groupId: existingGroup!.id })
          } catch (err) {
            console.warn(`[BackgroundTabService] ⚠️ Failed to move tabs to group "${level.label}":`, err)
          }
        }
      } else {
        try {
          const groupId = await (browser.tabs as any).group({ tabIds })
          groupMaps.groupByLabel.set(level.label, { id: groupId, title: level.label })
          groupsCreated++
        } catch (err) {
          console.warn(`[BackgroundTabService] ⚠️ Failed to create group "${level.label}":`, err)
        }
      }
    }

    if (options.reorderTabs) {
      await this.orderGroupsOldestFirst(plan, groupMaps.groupByLabel)
    }

    for (const level of plan.activeLevels) {
      const group = groupMaps.groupByLabel.get(level.label)
      if (!group?.id) continue
      await this.refreshGroupTitle(group.id, level.label, { color: level.color, collapsed: true })
    }

    return { groupsCreated, tabsMoved }
  }

  /**
   * Applies mock lastAccessed overrides to raw tabs (debug/testing only).
   *
   * Called by: getTabs() — the single place overrides are applied.
   *
   * When a mock override exists for a tabId, it replaces tab.lastAccessed in-memory.
   * The real browser tab is never modified — only the in-memory object used by grouping logic.
   *
   * Overrides persist in storage so tab ages stay consistent across page refreshes.
   * With no overrides stored (production) this is one storage read and a no-op loop.
   */
  private static async applyMockOverrides(tabs: { id?: number; lastAccessed?: number }[]): Promise<void> {
    try {
      // Object keys are always strings in JS, so overrides[5] and overrides["5"] are the same lookup.
      const overrides = await StorageRepository.getMockOverrides() ?? {}
      for (const tab of tabs) {
        const override = tab.id != null ? overrides[tab.id] : undefined
        if (override != null) {
          tab.lastAccessed = override  // ← Mutates in-memory tab object
        }
      }
    } catch (err) {
      console.warn('[BackgroundTabService] ⚠️ Failed to apply mock overrides:', err)
    }
  }

  static async groupTabsByAge(): Promise<number> {
    try {
      if (browser.tabGroups == null) return 0
      const result = await this.applyAgeGrouping({ reorderTabs: true })
      return result.groupsCreated
    } catch (err) {
      console.error('[BackgroundTabService] ❌', err)
      return 0
    }
  }

  /**
   * Move tabs to correct groups based on their age.
   * - Ungrouped old tabs (>7 days) → Week+ group
   * - Week+ tabs that aged (>14 days) → 2 Weeks+ group
   * - etc. for all levels
   *
   * Flow: Get all tabs → check age → move if group doesn't match age
   * Returns count of tabs moved.
   */
  static async updateTabByAge(): Promise<number> {
    try {
      if (browser.tabGroups == null) return 0
      const result = await this.applyAgeGrouping({ reorderTabs: false })
      console.log(`[BackgroundTabService] ✅ updateTabByAge: ${result.tabsMoved} tabs moved`)
      return result.tabsMoved
    } catch (err) {
      console.error('[BackgroundTabService] ❌ updateTabByAge error:', err)
      return 0
    }
  }


  static async ungroupAllTabs(): Promise<void> {
    try {
      if (browser.tabGroups == null) return
      // ✅ Use centralized getGroups() - only plugin groups, not user groups
      const groups = await this.getGroups()
      for (const group of groups) {
        const ids = (await browser.tabs.query({groupId: group.id}))
          .map(t => t.id).filter((id): id is number => id != null)
        if (ids.length) {
          await (browser.tabs as any).ungroup(ids)
        }
      }
    } catch (err) {
      console.error('[BackgroundTabService] ❌ ungroupAll error:', err)
    }
  }

  static async onTabActivated(tabId: number): Promise<void> {
    try {
      // 🎯 Filter: Only modify tabs IN plugin-created groups
      const inPluginGroup = await this.isInPluginGroup(tabId)
      if (!inPluginGroup) {
        return
      }

      // 📝 Get current tab + group info (guaranteed to exist after isInPluginGroup check)
      const tab = await browser.tabs.get(tabId)
      const groupId = tab.groupId as number

      let label: string | null
      try {
        label = this.getGroupLabel((await (browser.tabGroups as any).get(groupId)).title)
      } catch {
        // Group no longer exists (race condition), just return
        return
      }
      if (label == null) return

      // 🧩 Ungroup the tab, then move to rightmost — with retry
      const RETRIES = 3
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
          await (browser.tabs as any).ungroup([tabId])
          await browser.tabs.move(tabId, {index: -1})
        } catch (err) {
          // "Tabs cannot be edited right now" — Chrome is busy, retry
          if (attempt < RETRIES - 1) {
            await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
            continue
          }
          throw err
        }

        // Verify ungrouped
        const tabAfter = await browser.tabs.get(tabId)
        if (tabAfter.groupId === -1 || tabAfter.groupId == null) {
          // 📊 Update group title with new count
          await this.refreshGroupTitle(groupId, label)
          return
        }

        // Retry with backoff
        if (attempt < RETRIES - 1) {
          await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
        }
      }

      console.warn(`[BackgroundTabService] ⚠️ Tab#${tabId} still grouped after ${RETRIES} retries`)
    } catch (err) {
      console.error('[BackgroundTabService] ❌ onTabActivated error:', err)
    }
  }

  /**
   * Queries tabs from current window — ONLY plugin-managed tabs.
   *
   * Returns:
   * - All ungrouped tabs
   * - Tabs in plugin-created groups (title matches threshold labels)
   *
   * Excludes user-created groups entirely (isolation).
   *
   * 🧠 AUTO-DETECT MOCKS: If mock overrides are set in storage, applies them automatically.
   * This creates a clean separation:
   * • Production (no mocks set) → returns real lastAccessed
   * • Testing (mocks set) → applies mocks without special handling
   *
   * Used by: groupTabsByAge(), updateTabByAge(), createMockTabs()
   */
  /**
   * True for THIS extension's UI pages (options/popup) — they must never be grouped or auto-closed.
   * Built from runtime.getURL so it works in every browser
   * (chrome-extension:// in Chrome/Edge, moz-extension:// in Firefox).
   * Deliberately NOT excluding /mock.html: offline mock tabs must be grouped like real tabs.
   */
  private static isExtensionUiPage(url?: string): boolean {
    if (!url) return false
    return (['/options.html', '/popup.html'] as const).some(page => url.startsWith(browser.runtime.getURL(page)))
  }

  /**
   * URL of the offline mock page (src/entrypoints/mock) — no network needed.
   * @param title - tab title shown in the tab strip / options table
   * @param src - original URL, displayed as text only (never loaded)
   * @param icon - data:image/* favicon (non-data icons are ignored by the page)
   */
  static mockPageUrl(title: string, src?: string, icon?: string): string {
    const params = new URLSearchParams({ title })
    if (src) params.set('src', src)
    if (icon) params.set('icon', icon)
    return `${browser.runtime.getURL('/mock.html')}?${params}`
  }

  static async getTabs(): Promise<Browser.tabs.Tab[]> {
    const allTabs = await browser.tabs.query({currentWindow: true})

    let filteredTabs: Browser.tabs.Tab[] = []

    if (browser.tabGroups != null) {
      // ✅ Use centralized getGroups() - only plugin groups, not user groups
      const groups = await this.getGroups()
      // ✅ Safety: filter out groups without id (shouldn't happen, but defensive)
      const pluginGroupIds = new Set<number>(groups.filter(g => g.id != null).map(g => g.id))

      // Keep ungrouped + plugin-grouped tabs
      // Exclude our own UI pages to avoid grouping/closing the options page
      filteredTabs = allTabs.filter(t => {
        if (this.isExtensionUiPage(t.url)) return false
        if (t.groupId == null || t.groupId === -1) return true // Ungrouped
        return pluginGroupIds.has(t.groupId) // In plugin group
      })
    } else {
      // No tabGroups API: return all tabs except our own UI pages
      filteredTabs = allTabs.filter(t => !this.isExtensionUiPage(t.url))
    }

    await this.applyMockOverrides(filteredTabs)
    return filteredTabs
  }

  /**
   * Creates mock tabs — fully offline.
   *
   * @param useReal - If true, opens REAL browser tabs on the local mock page (offline, instant)
   *                  If false, returns synthetic tab objects only (no browser tabs created)
   *
   * Flow:
   * 1. Generate N mock tabs from MOCK_TABS array
   * 2. Build overrides map: tabId → (now - daysAgo * 24h)
   * 3. Set overrides in storage for applyMockOverrides() to use
   * 4. Return all tabs (mock + existing)
   */
  static async createMockTabs(useReal: boolean = true): Promise<Browser.tabs.Tab[]> {
    const DAY_MS = 86400000 // 24 hours in milliseconds
    // ✅ Use fake time if warped, otherwise real time
    const now = await getCurrentTime()

    let tabIds: number[] = []

    if (useReal) {
      // ── REAL MODE: real browser tabs on the offline mock page ──
      // No internet needed: title/favicon come from MOCK_TABS via query params,
      // the original URL is only displayed as text. tabs.create() resolves once the
      // tab exists (with its id) — nothing to wait for, so no fixed sleeps.
      for (const mock of MOCK_TABS) {
        const tab = await browser.tabs.create({
          url: this.mockPageUrl(mock.title, mock.url, mock.favIconUrl),
          active: false,
        })
        if (tab.id != null) tabIds.push(tab.id)
      }
    } else {
      // ── MOCK MODE: Create in-memory tab objects without network calls ──
      // For testing - fast, no network, deterministic
      // Generate synthetic but valid Browser.tabs.Tab objects
      tabIds = MOCK_TABS.map((_, i) => 1000 + i) // Synthetic IDs: 1000, 1001, ...
    }

    // Build overrides map: tabId → lastAccessed timestamp based on daysAgo
    const overridesMap: Record<number, number> = {}
    for (let i = 0; i < tabIds.length && i < MOCK_TABS.length; i++) {
      const tabId = tabIds[i]
      const daysAgo = MOCK_TABS[i].daysAgo ?? 1
      overridesMap[tabId] = now - daysAgo * DAY_MS
    }

    // Set overrides via WXT storage (unified approach with setMockOverrides action)
    try {
      await StorageRepository.setMockOverrides(overridesMap)
    } catch (err) {
      console.error(`[BackgroundTabService] ❌ Failed to set overrides:`, err)
    }

    if (!useReal) {
      // ── MOCK MODE: Extra delay to ensure storage persists, then return synthetic tabs ──
      await new Promise(r => setTimeout(r, 500))

      // Create synthetic tab objects for testing without network calls
      const mockTabs: Browser.tabs.Tab[] = tabIds.map((tabId, i) => ({
        id: tabId,
        windowId: 1,
        index: i,
        url: MOCK_TABS[i].url,
        title: MOCK_TABS[i].title,
        active: false,
        lastAccessed: overridesMap[tabId],
        favIconUrl: MOCK_TABS[i].favIconUrl,
        status: 'complete' as const,
        pinned: false,
        highlighted: false,
        frozen: false,
        incognito: false,
        discarded: false,
        autoDiscardable: true,
      } as Browser.tabs.Tab))

      return mockTabs
    } else {
      // setMockOverrides() above is awaited, so storage is already written — no delay needed.
      // ✅ getTabs() automatically applies mock overrides to all tabs
      return await this.getTabs()
    }
  }

  /**
   * Check if a tab is in a plugin-created group.
   * Plugin groups have titles like: "Week+ (5)", "Month+ (2)", etc.
   */
  private static async isInPluginGroup(tabId: number): Promise<boolean> {
    try {
      if (browser.tabGroups == null) return false // Firefox has no groups

      const tab = await browser.tabs.get(tabId)
      if (tab.groupId == null || tab.groupId === -1) return false // Not grouped

      const group = await (browser.tabGroups as any).get(tab.groupId)

      // Check if group title starts with any plugin label
      return this.getGroupLabel(group.title) != null
    } catch {
      return false
    }
  }

  /**
   * Check if ANY plugin-created groups exist in current window.
   * Used by UI to show/hide "Ungroup" button.
   */
  static async hasPluginGroups(): Promise<boolean> {
    try {
      if (browser.tabGroups == null) return false // Firefox has no groups

      // ✅ Use centralized getGroups() - returns only plugin groups
      const groups = await this.getGroups()
      return groups.length > 0
    } catch {
      return false
    }
  }

  /**
   * Close a tab and update its group name to reflect the new tab count.
   * If tab is in a plugin-created group, updates group title with (count-1).
   * Gracefully handles non-grouped tabs and Firefox (no tabGroups API).
   *
   * @param tabId - ID of the tab to close
   * @returns Error message or null if successful
   */
  static async closeTab(tabId: number): Promise<string | null> {
    try {
      const tab = await browser.tabs.get(tabId)

      // Remember the plugin group (if any) BEFORE closing — user groups are never renamed.
      let groupId: number | null = null
      let label: string | null = null
      if (browser.tabGroups != null && tab.groupId != null && tab.groupId !== -1) {
        try {
          label = this.getGroupLabel((await (browser.tabGroups as any).get(tab.groupId)).title)
          groupId = tab.groupId
        } catch {
          // Group query failed, skip update
        }
      }

      await browser.tabs.remove(tabId)
      console.log(`[BackgroundTabService] ✅ Closed tab#${tabId}`)

      // Plugin group → new count in title. If it was the last tab, the browser already removed the group.
      if (groupId != null && label != null) {
        await this.refreshGroupTitle(groupId, label)
      }

      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[BackgroundTabService] ❌ closeTab error:`, msg)
      return msg
    }
  }

  /**
   * Focus/activate a tab and bring its window to foreground
   * User can then investigate the tab content before closing manually
   */
  static async focusTab(tabId: number): Promise<string | null> {
    try {
      const tab = await browser.tabs.get(tabId)

      // Activate the tab (brings it to focus)
      await browser.tabs.update(tabId, {active: true})

      // Bring window to foreground if tab is in a window
      if (tab.windowId != null) {
        await (browser.windows as any).update(tab.windowId, {focused: true})
      }

      console.log(`[BackgroundTabService] ✅ Focused tab#${tabId}`)
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[BackgroundTabService] ❌ focusTab error:`, msg)
      return msg
    }
  }


  /**
   * Open an offline mock tab titled with a random [0-9A-Z] id, optionally in a group.
   * @param newTabGroup - If true, creates a random group for the tab
   * @param index - Optional position index for the tab (default: rightmost)
   * @returns generated alphanumeric ID (4 random chars: 0-9 or A-Z)
   */
  static async openRandomTabInGroup(newTabGroup: boolean = false, index: number = 0): Promise<string> {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const generatedTabId = Array.from({length: 4}, () =>
      chars[Math.floor(Math.random() * chars.length)]).join('')

    try {
      const url = this.mockPageUrl(generatedTabId, `https://www.example.com/${generatedTabId}`)
      const tab = await browser.tabs.create({url, active: false})

      // ✅ Safety check: tab.id must exist before using it
      if (tab.id == null) {
        throw new Error('Failed to create tab - no tab ID returned')
      }

      await browser.tabs.move(tab.id, {index}).catch(() => {
        throw new Error('Failed to move tab')
      })
      if (newTabGroup) {
        const groupId = await (browser.tabs as any).group({tabIds: [tab.id]})
        await (browser.tabGroups as any).update(groupId, {title: `${generatedTabId}_randomGroup`})
      }
    } catch (err) {
      console.error('[BackgroundTabService] ❌ openRandomTabInGroup error:', err)
      throw err
    }

    return generatedTabId
  }

  /**
   * Get all groups and tabs data with applied mock overrides.
   * Returns group count, group details sorted by position, and tab counts.
   *
   * Replaces: OptionsPage.getGroupAndTabData()
   * Now accessible via RPC for type-safe calls from UI components.
   */
  static async getGroupAndTabData(): Promise<{
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
    try {
      // Note: getTabs() already applies mock overrides — no need to re-apply here.
      if (browser.tabGroups == null) {
        // Firefox: no tab groups, return only ungrouped tabs
        const tabs = await this.getTabs()
        return {
          groupCount: 0,
          groupsOrderedByIndex: [],
          groupedTabCount: 0,
          ungroupedTabCount: tabs.length,
          tabs: tabs.map((t: any) => ({
            id: t.id,
            url: t.url,
            title: t.title,
            active: t.active,
            lastAccessed: t.lastAccessed,
            groupId: -1,
            windowIndex: t.index,
            positionInGroup: null,
          })),
        }
      }

      // Chrome/Edge: query groups and tabs
      // ✅ Query ALL groups (plugin + user-created) for complete reporting
      const groups = await this.getGroups(true)
      const allTabs = await this.getTabs()

      // Calculate group index: use group.index if available, else use first tab's index
      const groupIndexMap = new Map<number, number>()
      for (const group of groups) {
        // ✅ Safety check: group must have id
        if (group.id == null) continue

        // ✅ Prefer group.index from API, fallback to first tab's index if undefined
        if (group.index != null) {
          groupIndexMap.set(group.id, group.index)
        } else {
          const groupTabs = allTabs.filter((t: any) => t.groupId === group.id)
          if (groupTabs.length > 0) {
            groupIndexMap.set(group.id, groupTabs[0].index ?? -1)
          } else {
            groupIndexMap.set(group.id, -1)
          }
        }
      }

      // Build final groups with calculated indices
      const groupsWithIndices = groups.map((g: any) => ({
        id: g.id,
        title: g.title,
        index: groupIndexMap.get(g.id) ?? g.index ?? -1,
      }))

      // Sort groups by calculated index (left-to-right, oldest→youngest)
      // Lower index = leftmost = oldest, higher index = rightmost = youngest
      groupsWithIndices.sort((a: any, b: any) => (a.index ?? -1) - (b.index ?? -1))

      return {
        groupCount: groupsWithIndices.length,
        groupsOrderedByIndex: groupsWithIndices,
        groupedTabCount: allTabs.filter((t: any) => t.groupId != null && t.groupId !== -1).length,
        ungroupedTabCount: allTabs.filter((t: any) => t.groupId == null || t.groupId === -1).length,
        tabs: allTabs.map((t: any) => {
          const positionInGroup = t.groupId && t.groupId !== -1
            ? allTabs.filter((tab: any) => tab.groupId === t.groupId && tab.index < t.index).length + 1
            : null
          return {
            id: t.id,
            url: t.url,
            title: t.title,
            active: t.active,
            lastAccessed: t.lastAccessed,
            groupId: t.groupId,
            windowIndex: t.index,
            positionInGroup,
          }
        }),
      }
    } catch (err) {
      console.error('[BackgroundTabService] ❌ getGroupAndTabData error:', err)
      return {
        groupCount: 0,
        groupsOrderedByIndex: [],
        groupedTabCount: 0,
        ungroupedTabCount: 0,
        tabs: [],
      }
    }
  }

  /**
   * Auto-close all tabs in the oldest (leftmost) group.
   * The oldest group is the one with the lowest index value.
   *
   * Returns:
   * - Number of tabs closed
   * - 0 if no groups exist or operation fails
   *
   * Used by: Auto-close timer (1 day after last close)
   */
  static async autoCloseOldestGroupTabs(): Promise<number> {
    try {
      if (browser.tabGroups == null) {
        console.log('[BackgroundTabService] ℹ️ No tabGroups API available, skipping auto-close')
        return 0
      }

      // Target ONLY the group of the last active threshold level (e.g. "Hell!"),
      // which is what the Auto-close toggle promises the user.
      // ⚠️ Never fall back to "leftmost group" or to an undefined groupId:
      //    tabs.query({ groupId: undefined }) returns EVERY tab in EVERY window.
      const thresholds = await this.getThresholds()
      const activeLevels = thresholds.activeThresholdLevels()
      const oldestLevel = activeLevels[activeLevels.length - 1]
      if (oldestLevel == null) return 0

      const groups = await this.getGroups()
      const oldestGroup = groups.find(g => this.getGroupLabel(g.title) === oldestLevel.label)
      if (oldestGroup?.id == null || oldestGroup.id === -1) {
        console.log(`[BackgroundTabService] ℹ️ No "${oldestLevel.label}" group, nothing to auto-close`)
        return 0
      }
      const oldestGroupTitle = oldestGroup.title

      // Close tabs in that group that are at least 1 day older than the level's age
      const tabsInOldestGroup = await browser.tabs.query({groupId: oldestGroup.id})
      const now = await getCurrentTime()
      const tabsToClose = tabsInOldestGroup.filter(tab => {
        if (tab.groupId !== oldestGroup.id) return false // defensive: never touch other tabs
        if (tab.active || tab.pinned || tab.lastAccessed == null) return false
        const ageDays = (now - tab.lastAccessed) / 86400000
        return ageDays > oldestLevel.days + 1
      })
      //close those tabs and return the amount of closed tabs
      if (tabsToClose.length > 0) {
        const tabIdsToClose = tabsToClose.map(tab => tab.id).filter((id): id is number => id != null)
        await browser.tabs.remove(tabIdsToClose)
        console.log(`[BackgroundTabService] 🔥 Auto-closed ${tabIdsToClose.length} tabs in oldest group "${oldestGroupTitle}"`)
        return tabIdsToClose.length
      } else {
        console.log(`[BackgroundTabService] ℹ️ No tabs to auto-close in oldest group "${oldestGroupTitle}"`)
        return 0
      }
    } catch (err) {
      console.error('[BackgroundTabService] ❌ Failed to auto-close tabs:', err)
      return 0
    }
  }

  /**
   * 🧪 DEV-ONLY: Manually trigger the 24h alarm to test groupTabsByAge() behavior.
   * Simulates: browser.alarms fires after 24 hours.
   *
   * If autoClose is enabled:
   * - After grouping, closes all tabs in the oldest group (Hell! group)
   * - Removes the oldest group
   *
   * Returns: count of groups created after grouping
   *
   * Used by: Dev UI button "Test 24h Alarm" in Options Page (dev mode only)
   */
  static async testTriggerAlarm24h(): Promise<number> {
      console.log('[BackgroundTabService] 🧪 DEV: Manually triggering 24h alarm...')
      try {
        // Step 1: Group tabs by age
        const result = await this.groupTabsByAge()
        console.log(`[BackgroundTabService] 🧪 DEV: Alarm triggered → ${result} groups created`)

        // Step 2: Check if autoClose is enabled
        const appState = await StorageRepository.storage.appStateStorage.getValue()
        const isAutoCloseEnabled = appState?.autoClose ?? false

        if(isAutoCloseEnabled) {
          console.log('[BackgroundTabService] 🔥 autoClose is ENABLED - closing oldest group...')
          const closedCount = await this.autoCloseOldestGroupTabs()
          console.log(`[BackgroundTabService] ✅ Auto-close completed: removed ${closedCount} tabs from oldest group`)
        } else {
          console.log('[BackgroundTabService] 🛡️  autoClose is DISABLED - skipping tab auto-close')
        }

        return result
      } catch(err) {
        console.error('[BackgroundTabService] ❌ DEV: Failed to trigger alarm:', err)
        throw err
      }
    }

    /**
     * 🧪 DEBUG-ONLY: Get diagnostic info for understanding tab operations.
     * Useful for spying on what's happening during tests.
     */
    static async getDiagnostics(): Promise<{
      allTabs: Array<{ id?: number; title?: string; groupId?: number; lastAccessed?: number }>;
      allGroups: Array<{ id: number; title: string; index?: number }>;
      tabsInOldestGroup: Array<{ id?: number; title?: string; age?: number }>;
      oldestGroupInfo?: { id: number; title: string };
    }> {
      try {
        const now = await getCurrentTime();
        const allTabs = await this.getTabs();
        const allGroups = await this.getGroups(true); // Get all groups including user-created
        const oldestGroup = await this.getGroupByIndex();

        // Get tabs in oldest group if it exists
        let tabsInOldestGroup: Array<{ id?: number; title?: string; age?: number }> = [];
        if (oldestGroup?.id != null) {
          const oldest = await browser.tabs.query({ groupId: oldestGroup.id });
          tabsInOldestGroup = oldest.map(tab => ({
            id: tab.id,
            title: tab.title,
            age: tab.lastAccessed ? Math.round((now - tab.lastAccessed) / 86400000) : undefined
          }));
        }

        const result = {
          allTabs: allTabs.map(t => ({
            id: t.id,
            title: t.title,
            groupId: t.groupId,
            lastAccessed: t.lastAccessed
          })),
          allGroups: allGroups.map(g => ({
            id: g.id,
            title: g.title,
            index: g.index
          })),
          tabsInOldestGroup,
          oldestGroupInfo: oldestGroup ? { id: oldestGroup.id, title: oldestGroup.title } : undefined
        };

        console.log('[BackgroundTabService] 🔍 DIAGNOSTICS:', result);
        return result;
      } catch (err) {
        console.error('[BackgroundTabService] ❌ getDiagnostics error:', err);
        throw err;
      }
    }

    /**
     * Get the oldest (first/leftmost) plugin-created group.
     * Returns null if no groups exist.
     */
    private static async getGroupByIndex(): Promise<{ id: number; title: string; index?: number } | null> {
      try {
        if (browser.tabGroups == null) return null;

        const groups = await this.getGroups();
        if (groups.length === 0) return null;

        // Return first group (lowest index = leftmost = oldest)
        return groups[0] || null;
      } catch {
        return null;
      }
    }
  }
