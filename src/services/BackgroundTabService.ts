/**
 * BackgroundTabService — tab operations for the background service worker.
 *
 * Runs WITHOUT Pinia (background has its own isolated VM).
 * Reads config from browser.storage, operates directly on browser.tabs APIs.
 * Writes tab snapshots to browser.storage so UI contexts can sync via TabStore.initStorageSync().
 *
 * CROSS-BROWSER SUPPORT:
 *   ✅ Chrome/Edge: Full tab grouping support via browser.tabGroups API
 *   ✅ Firefox: No tabGroups API, gracefully skips grouping
 *   ✅ All browsers: Tab activation, storage sync, lastAccessed updates
 *
 * Flow:
 *   browser.alarms → groupTabsByAge() → browser.storage (snapshot)
 *   browser.tabs.onActivated → onTabActivated() → browser.storage
 */

import { ClassifiedTabFactory } from '@/models/tabs/ClassifiedTab'
import { TabRow } from '@/models/tabs/TabRow'
import { AgeClassification } from '@/models/tabs/AgeClassification'
import StorageService from '@/services/StorageService'
import { APP_CONSTANTS } from '@/constants'
import type { ThresholdLevel } from '@/constants'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'
import { tabStorageItem } from '@/utils/tabStorage'
import { browser } from 'wxt/browser'

export class BackgroundTabService {
  /**
   * Reads age thresholds from storage.
   * Falls back to DEFAULT_THRESHOLDS if storage is empty.
   */
  static async getThresholds(): Promise<AppThresholds> {
    const stored = await StorageService.get<{ thresholds?: { levels?: Partial<ThresholdLevel>[]; activeLevels?: number } }>(APP_CONSTANTS.STORE_GLOBAL_STORE)
    if (stored?.thresholds?.levels) {
      return AppThresholds.fromObject(stored.thresholds)
    }
    return DEFAULT_THRESHOLDS
  }


  /**
   * Groups tabs by age using tab groups API (Chrome/Edge), then persists snapshot.
   * Called by the daily alarm.
   *
   * Preserves custom lastAccessed values from storage (e.g. mock/backdated tabs).
   * Browser's native lastAccessed is only used as fallback when no stored value exists.
   *
   * CROSS-BROWSER BEHAVIOR:
   *   ✅ Chrome/Edge: Creates age-based groups using browser.tabGroups API
   *   ✅ Firefox: Skips grouping (no tabGroups API), but persists snapshot
   */
  static async groupTabsByAge(): Promise<void> {
    console.log('[BackgroundTabService] Starting groupTabsByAge...')
    try {
      const hasTabGroups = browser.tabGroups != null
      const rawTabs = await browser.tabs.query({ currentWindow: true })
      const thresholds = await this.getThresholds()

      // Load existing snapshot to preserve custom/mock lastAccessed timestamps.
      // Browser's native tab.lastAccessed reflects real user activity, not our stored values.
      const stored = await tabStorageItem.getValue()
      const storedLastAccessed = new Map<number, number>()
      for (const t of (stored?.tabs ?? []) as Array<Record<string, unknown>>) {
        if (t.id != null && t.lastAccessed != null) {
          storedLastAccessed.set(t.id as number, t.lastAccessed as number)
        }
      }

      // Classify tabs, preferring stored lastAccessed over the browser's real-time value
      const classified: ClassifiedTab[] = rawTabs.map(rawTab => {
        const base = ClassifiedTabFactory.fromTab(rawTab, false)
        const savedLastAccessed = rawTab.id != null ? storedLastAccessed.get(rawTab.id) : undefined
        return Object.assign({}, base, {
          lastAccessed: savedLastAccessed ?? rawTab.lastAccessed,
        })
      })

      const rows = TabRow.fromTabs(classified, thresholds)

      // Create arrays for each active threshold level
      const activeThresholdsList = thresholds.active()
      const levelTabIds: number[][] = []
      for (let i = 0; i < activeThresholdsList.length; i++) {
        levelTabIds[i] = []
      }

      for (const row of rows) {
        if (row.id == null) continue
        const c = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)
        const idx = classified.findIndex(t => t.id === row.id)
        if (idx !== -1) {
          classified[idx] = Object.assign({}, classified[idx], { ageIndex: c.index })
        }
        if (c.index > 0 && c.index <= activeThresholdsList.length) {
          levelTabIds[c.index - 1].push(row.id)
        }
      }

      // ✅ Only attempt grouping in Chrome/Edge
      if (hasTabGroups) {
        const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
          if (!ids.length) return null
          try {
            const id = await (chrome as any).tabs.group({ tabIds: ids })
            await (chrome as any).tabGroups.update(id, { title, color, collapsed: true })
            return id
          } catch (err) {
            console.debug('[BackgroundTabService] createGroup error:', err)
            return null
          }
        }

        const groupIds: (number | null)[] = []
        for (let i = activeThresholdsList.length - 1; i >= 0; i--) {
          const level = activeThresholdsList[i]
          const groupId = await createGroup(levelTabIds[i], `${level.label}+ (${levelTabIds[i].length})`, level.color)
          groupIds.push(groupId)
        }

        if ((chrome as any)?.tabGroups?.move) {
          for (const id of groupIds.reverse()) {
            if (id !== null) {
              try {
                await (chrome as any).tabGroups.move(id, { index: 0 })
              } catch (err) {
                console.debug('[BackgroundTabService] moveGroup error:', err)
              }
            }
          }
        }

        console.log(`[BackgroundTabService] ✅ Grouped ${classified.length} tabs into groups (Chrome/Edge)`)
      } else {
        console.log(`[BackgroundTabService] ℹ️ Tab grouping not available (Firefox) - storing classification only`)
      }

      // Persist plain snapshot — structured clone safe (no class instances, no Proxies)
      await tabStorageItem.setValue({
        tabs: classified,
        isGrouped: hasTabGroups,
        savedAt: new Date().toISOString(),
      })

      console.log(`[BackgroundTabService] ✅ Persisted ${classified.length} tabs to storage`)
    } catch (err) {
      console.error('[BackgroundTabService] ❌ groupTabsByAge error:', err instanceof Error ? err.message : err)
    }
  }

  /**
   * Handles tab activation: moves tab from old group to rightmost (fresh), updates lastAccessed.
   * Called when user clicks on a tab in an old/middle/young group.
   *
   * CROSS-BROWSER BEHAVIOR:
   *   ✅ Chrome/Edge: Ungrouping + moving to rightmost
   *   ✅ Firefox: Moving to rightmost + updating lastAccessed
   */
  static async onTabActivated(tabId: number): Promise<void> {
    console.log(`[BackgroundTabService] 🔧 onTabActivated called for tab#${tabId}`)

    try {
      if (browser.tabs == null) {
        console.warn('[BackgroundTabService] ⚠️ browser.tabs not available (should not happen)')
        return
      }

      const isFirefox = import.meta.env.FIREFOX === true
      const tab = await browser.tabs.get(tabId)

      console.log(`[BackgroundTabService] 📋 Tab#${tabId} info:`, {
        groupId: tab.groupId,
        index: tab.index,
        title: tab.title?.substring(0, 50),
        url: tab.url?.substring(0, 50)
      })

      if (tab.groupId === undefined || tab.groupId === -1) {
        console.log(`[BackgroundTabService] ℹ️ Tab#${tabId} is not in a group (groupId: ${tab.groupId}) - skipping`)
        return
      }

      if (!isFirefox) {
        await this.ungroupAndMoveTab(tabId)
      } else {
        console.log('[BackgroundTabService] ℹ️ Firefox detected → skipping ungroup (no MV3 API), moving to rightmost')
        await this.moveTabAndUpdate(tabId)
      }
    } catch (err) {
      console.error(`[BackgroundTabService] ❌ Unexpected error in onTabActivated:`, err)
    }
  }

  /**
   * Ungroups a tab (Chrome/Edge) then moves it to rightmost and updates lastAccessed.
   */
  private static async ungroupAndMoveTab(tabId: number): Promise<void> {
    try {
      await (browser.tabs as any).ungroup(tabId)
      console.log(`[BackgroundTabService] ✅ Ungrouped tab#${tabId}`)
    } catch (err) {
      console.warn(`[BackgroundTabService] ⚠️ ungroup failed for tab#${tabId}:`, err)
    }

    await this.moveTabAndUpdate(tabId)
  }

  /**
   * Moves a tab to rightmost position and updates lastAccessed timestamp.
   * Works in all browsers.
   */
  private static async moveTabAndUpdate(tabId: number): Promise<void> {
    try {
      const movedTab = await browser.tabs.move(tabId, { index: -1 })
      console.log(`[BackgroundTabService] 🎉 Success! Tab#${tabId} moved to position ${movedTab?.index}`)

      const snapshot = await tabStorageItem.getValue()
      if (snapshot?.tabs) {
        const now = Date.now()
        const updatedTabs = (Array.isArray(snapshot.tabs) ? snapshot.tabs : Object.values(snapshot.tabs as Record<string, unknown>))
          .map((t: unknown) => {
            const tab = t as ClassifiedTab
            return tab.id === tabId
              ? Object.assign({}, tab, { lastAccessed: now })
              : Object.assign({}, tab)
          })

        await tabStorageItem.setValue({
          tabs: updatedTabs,
          isGrouped: snapshot.isGrouped ?? false,
          savedAt: new Date().toISOString(),
        })

        console.log(`[BackgroundTabService] ⏰ Updated tab#${tabId} lastAccessed to ${new Date(now).toISOString()}`)
      }
    } catch (err) {
      console.warn(`[BackgroundTabService] ⚠️ move failed for tab#${tabId}:`, err)
    }
  }
}

