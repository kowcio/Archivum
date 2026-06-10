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

import { TabRow } from '@/models/tabs/TabRow'
import { AgeClassification } from '@/models/tabs/AgeClassification'
import { configStorage } from '@/utils/configStorage'
import { mockOverrides } from '@/utils/mockStorage'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { browser } from 'wxt/browser'

export class BackgroundTabService {
  static async getThresholds(): Promise<AppThresholds> {
    const stored = await configStorage.getValue()
    if (stored?.thresholds?.levels) {
      return AppThresholds.fromObject(stored.thresholds)
    }
    return DEFAULT_THRESHOLDS
  }

  /**
   * Applies mock lastAccessed overrides to raw tabs (debug).
   * When a mock override exists for a tabId, it replaces tab.lastAccessed.
   * Overrides are then cleared so they only apply once.
   */
  /**
   * Applies mock lastAccessed overrides to raw tabs (debug).
   * When a mock override exists for a tabId, it replaces tab.lastAccessed.
   * Overrides persist so tab ages stay correct across page refreshes.
   */
  private static async applyMockOverrides(tabs: { id?: number; lastAccessed?: number }[]): Promise<void> {
    const overrides = await mockOverrides.getValue()
    const ids = Object.keys(overrides).map(Number)
    if (!ids.length) return

    for (const tab of tabs) {
      if (tab.id != null && overrides[tab.id] != null) {
        tab.lastAccessed = overrides[tab.id]
      }
    }
    console.log('[BackgroundTabService] Applied mock overrides to', ids.length, 'tabs')
  }

  static async groupTabsByAge(): Promise<number> {
    console.log('[BackgroundTabService] groupTabsByAge...')
    try {
      const hasTabGroups = browser.tabGroups != null
      if (!hasTabGroups) {
        console.log('[BackgroundTabService] ℹ️ Tab grouping not available (Firefox)')
        return 0
      }

      const rawTabs = await browser.tabs.query({ currentWindow: true })
      const thresholds = await this.getThresholds()

      // Apply mock overrides if present (debug)
      await this.applyMockOverrides(rawTabs)

      const rows = TabRow.fromTabs(rawTabs, thresholds)
      const activeLevels = thresholds.active()
      const levelTabIds: number[][] = Array.from({ length: activeLevels.length }, () => [])
      const freshTabIds: number[] = []

      // Build age map for sorting
      const ageMap = new Map<number, number>()
      for (const row of rows) {
        if (row.id != null) ageMap.set(row.id, row.lastAccessDays ?? 0)
      }

      for (const row of rows) {
        if (row.id == null) continue
        const c = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)
        if (c.index === 0) {
          freshTabIds.push(row.id)
        } else if (c.index > 0 && c.index <= activeLevels.length) {
          levelTabIds[c.index - 1].push(row.id)
        }
      }

      // Sort tabs within each level by age (oldest first = highest lastAccessDays first)
      for (const ids of levelTabIds) {
        ids.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
      }

      const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
        if (!ids.length) return null
        try {
          const id = await (chrome as any).tabs.group({ tabIds: ids })
          await (chrome as any).tabGroups.update(id, { title, color, collapsed: true })
          return id
        } catch {
          return null
        }
      }

      // Create groups from oldest → youngest so they appear left-to-right
      let groupsCreated = 0
      for (let i = activeLevels.length - 1; i >= 0; i--) {
        const level = activeLevels[i]
        const gid = await createGroup(levelTabIds[i], `${level.label}+ (${levelTabIds[i].length})`, level.color)
        if (gid !== null) groupsCreated++
      }

      // Move fresh (ungrouped) tabs to the rightmost, sorted by age (oldest first)
      if (freshTabIds.length > 0) {
        freshTabIds.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
        try {
          await browser.tabs.move(freshTabIds, { index: -1 })
        } catch {
          // Some browsers may not support moving all at once — fallback to sequential
          for (const id of freshTabIds) {
            try { await browser.tabs.move(id, { index: -1 }) } catch { }
          }
        }
      }

      console.log(`[BackgroundTabService] ✅ Created ${groupsCreated} age groups, ${freshTabIds.length} fresh tabs moved to rightmost`)
      return groupsCreated
    } catch (err) {
      console.error('[BackgroundTabService] ❌', err)
      return 0
    }
  }

  static async ungroupAllTabs(): Promise<void> {
    try {
      if (browser.tabGroups == null) return
      const groups = await (browser.tabGroups as any).query({ windowId: browser.windows.WINDOW_ID_CURRENT })
      for (const group of groups) {
        const ids = (await browser.tabs.query({ groupId: group.id }))
          .map(t => t.id).filter((id): id is number => id != null)
        if (ids.length) {
          await (browser.tabs as any).ungroup(ids)
        }
      }
      console.log('[BackgroundTabService] ✅ Ungrouped all tabs')
    } catch (err) {
      console.error('[BackgroundTabService] ❌ ungroupAll error:', err)
    }
  }

  static async onTabActivated(tabId: number): Promise<void> {
    try {
      const tab = await browser.tabs.get(tabId)
      if (tab.groupId === undefined || tab.groupId === -1) return

      if (browser.tabGroups != null) {
        try { await (browser.tabs as any).ungroup(tabId) } catch { }
      }

      await browser.tabs.move(tabId, { index: -1 })
      console.log(`[BackgroundTabService] ✅ Tab#${tabId} moved to rightmost`)
    } catch (err) {
      console.error(`[BackgroundTabService] ❌ onTabActivated error:`, err)
    }
  }

  /**
   * Queries tabs from current window with mock overrides applied.
   * Used by UI contexts to get correct lastAccessed values for display.
   */
  static async getTabs(): Promise<browser.tabs.Tab[]> {
    const rawTabs = await browser.tabs.query({ currentWindow: true })
    // Deep clone to avoid mutating the original tab objects
    const tabs: browser.tabs.Tab[] = JSON.parse(JSON.stringify(rawTabs))
    await this.applyMockOverrides(tabs)
    return tabs
  }
}
