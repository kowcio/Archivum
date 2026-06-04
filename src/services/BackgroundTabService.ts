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
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { TabsSnapshot } from '@/models/tabs/TabsSnapshot'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'
import { tabStorageItem } from '@/utils/tabStorage'
import { browser } from 'wxt/browser'

export class BackgroundTabService {
  /**
   * Reads age thresholds from storage.
   * Falls back to DEFAULT_THRESHOLDS if storage is empty.
   */
  static async getThresholds(): Promise<AppThresholds> {
    const stored = await StorageService.get<{ thresholds?: { young: number; middle: number; old: number } }>(APP_CONSTANTS.STORAGE_KEY)
    if (stored?.thresholds) {
      return AppThresholds.fromObject(stored.thresholds)
    }
    return DEFAULT_THRESHOLDS
  }

  /**
   * Groups tabs by age using tab groups API (Chrome/Edge), then persists snapshot.
   * Called by the daily alarm.
   *
   * CROSS-BROWSER BEHAVIOR:
   *   ✅ Chrome/Edge: Creates age-based groups using browser.tabGroups API
   *   ✅ Firefox: Skips grouping (no tabGroups API), but persists snapshot
   *              Users can manually group via native UI if desired
   *
   * Creates age-based groups: Old / Middle / Young (threshold-based titles).
   * Moves groups to the left so tabs flow: oldest (left) → youngest (right).
   */
  static async groupTabsByAge(): Promise<void> {
    console.log('[BackgroundTabService] Starting groupTabsByAge...')
    try {
      // ✅ Feature detection: Tab grouping (Chrome/Edge only)
      const hasTabGroups = browser.tabGroups != null

      // ✅ Unified API: Works in all browsers
      const rawTabs = await browser.tabs.query({ currentWindow: true })
      const thresholds = await this.getThresholds()
      const classified: ClassifiedTab[] = ClassifiedTabFactory.fromTabs(rawTabs)
      const rows = TabRow.fromTabs(classified, thresholds)

      const oldTabIds: number[] = []
      const middleTabIds: number[] = []
      const youngTabIds: number[] = []

      for (const row of rows) {
        if (row.id == null) continue
        const c = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)
        const idx = classified.findIndex(t => t.id === row.id)
        if (idx !== -1) {
          classified[idx] = { ...classified[idx], ageIndex: c.index }
        }
        if (c.isOld) oldTabIds.push(row.id)
        else if (c.isMiddle) middleTabIds.push(row.id)
        else if (c.isYoung) youngTabIds.push(row.id)
      }

      // ✅ Only attempt grouping in Chrome/Edge
      if (hasTabGroups) {
        const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
          if (!ids.length) return null
          try {
            // Use native chrome API for grouping (better compatibility)
            const id = await (chrome as any).tabs.group({ tabIds: ids })
            await (chrome as any).tabGroups.update(id, { title, color, collapsed: false })
            return id
          } catch (err) {
            console.debug('[BackgroundTabService] createGroup error:', err)
            return null
          }
        }

        const oldGroupId = await createGroup(oldTabIds, `Old ${thresholds.old}d+`, 'red')
        const middleGroupId = await createGroup(middleTabIds, `Middle ${thresholds.middle}d+`, 'orange')
        const youngGroupId = await createGroup(youngTabIds, `Young ${thresholds.young}d+`, 'yellow')

        // Move groups to the left: oldest → youngest (left to right flow)
        if ((chrome as any)?.tabGroups?.move) {
          for (const id of [oldGroupId, middleGroupId, youngGroupId]) {
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
        console.log(`[BackgroundTabService] ℹ️ Tab grouping not available (Firefox) - skipping grouping, but storing classification`)
      }

      // ✅ Persist snapshot (works in all browsers)
      const snapshot = new TabsSnapshot(classified, hasTabGroups, new Date().toISOString())
      await tabStorageItem.setValue(snapshot)

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
   *        Firefox Note: No tabs.ungroup() in MV3. Tab stays visually in group but is
   *        reclassified as "Fresh" and won't be re-grouped next alarm cycle.
   *
   * Steps:
   *   1. Ungroup the tab (Chrome/Edge only via native chrome API callback)
   *   2. Move to rightmost position (index: -1) — all browsers
   *   3. Update tab's lastAccessed timestamp to now (reclassifies as Fresh in Firefox)
   *   4. Persist updated snapshot to storage → TabStore syncs, Options table updates
   */
  static async onTabActivated(tabId: number): Promise<void> {
    console.log(`[BackgroundTabService] 🔧 onTabActivated called for tab#${tabId}`)

    try {
      // ✅ Check if browser.tabs exists (should always be true)
      if (browser.tabs == null) {
        console.warn('[BackgroundTabService] ⚠️ browser.tabs not available (should not happen)')
        return
      }

      // Detect Firefox using WXT's compile-time constant (most reliable)
      const isFirefox = import.meta.env.FIREFOX === true

      console.log(`[BackgroundTabService] 🔍 Getting tab#${tabId} info...`)

      // ✅ Unified API: Works in all browsers (callback-based for MV3)
      browser.tabs.get(tabId, (tab: any) => {
        if (browser.runtime.lastError) {
          console.error('[BackgroundTabService] ❌ browser.tabs.get error:', browser.runtime.lastError.message)
          return
        }

        if (!tab) {
          console.error(`[BackgroundTabService] ❌ Tab#${tabId} not found`)
          return
        }

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

        console.log(`[BackgroundTabService] 🔓 Ungrouping tab#${tabId} from group#${tab.groupId}...`)

        // ⚠️ Firefox MV3 has NO ungroup API
        // Chrome/Edge: Use callback-based native chrome.tabs.ungroup()
        // Firefox: Skip ungroup, move directly. Tab will be reclassified as "Fresh"
        //          by lastAccessed update, so it won't re-group in next cycle.
        if (!isFirefox) {
          console.log(`[BackgroundTabService] ℹ️ Chrome/Edge detected → attempting ungroup via native API`)
          this.ungroupWithRetry(tabId, 0)
        } else {
          console.log('[BackgroundTabService] ℹ️ Firefox detected → skipping ungroup (no MV3 API), moving to rightmost to mark as Fresh')
          this.moveTabWithRetry(tabId, 0)
        }
      })
    } catch (err) {
      console.error(`[BackgroundTabService] ❌ Unexpected error in onTabActivated:`, err)
    }
  }

  /**
   * Helper: Ungroup tab with retry mechanism (exponential backoff)
   * Handles race conditions when browser is busy with tab operations
   *
   * ⚠️  Chrome/Edge ONLY: Uses callback-based native chrome.tabs.ungroup()
   * ⚠️  Firefox: NOT CALLED. Firefox MV3 has no ungroup API in service workers.
   *     Firefox MV3 limitation: tabs.ungroup() is Promise-based, incompatible with MV3
   *     service worker callbacks. Tab stays in group, but lastAccessed update
   *     reclassifies it as "Fresh" so it won't re-group on next daily cycle.
   */
  private static ungroupWithRetry(tabId: number, attempt: number): void {
    const maxAttempts = 5
    const baseDelay = 100 // ms

    if (attempt >= maxAttempts) {
      console.error(`[BackgroundTabService] ❌ Failed to ungroup tab#${tabId} after ${maxAttempts} attempts`)
      return
    }

    // Chrome/Edge only: browser.tabs.ungroup
    (browser.tabs as any).ungroup(tabId, () => {
      if (browser.runtime.lastError) {
        const errorMsg = browser.runtime.lastError.message || ''

        // Check if error is due to browser being busy (can retry)
        if (errorMsg.includes('cannot be edited right now') ||
            errorMsg.includes('dragging') ||
            errorMsg.includes('busy')) {
          const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
          console.warn(`[BackgroundTabService] ⏳ Tab busy, retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`)

          setTimeout(() => {
            this.ungroupWithRetry(tabId, attempt + 1)
          }, delay)
          return
        }

        // Other errors - don't retry
        console.error('[BackgroundTabService] ❌ ungroup error (not retrying):', errorMsg)
        return
      }

      // Success - now move the tab
      console.log(`[BackgroundTabService] ✅ Ungrouped tab#${tabId}`)
      console.log(`[BackgroundTabService] ➡️ Moving tab#${tabId} to rightmost position...`)

      this.moveTabWithRetry(tabId, 0)
    })
  }

  /**
   * Helper: Move tab with retry mechanism (exponential backoff)
   * After successful move, updates tab's lastAccessed timestamp and persists to storage.
   *
   * ✅ Works in all browsers (Chrome, Edge, Firefox).
   *
   * ℹ️  Firefox "soft ungroup": Updating lastAccessed to "today" reclassifies tab as "Fresh".
   *     On next daily grouping cycle, Fresh tabs are grouped separately, so the tab
   *     effectively leaves the old group without needing explicit ungroup API.
   */
  private static moveTabWithRetry(tabId: number, attempt: number): void {
    const maxAttempts = 5
    const baseDelay = 100 // ms

    if (attempt >= maxAttempts) {
      console.error(`[BackgroundTabService] ❌ Failed to move tab#${tabId} after ${maxAttempts} attempts`)
      return
    }

    browser.tabs.move(tabId, { index: -1 }, async (movedTab: any) => {
      if (browser.runtime.lastError) {
        const errorMsg = browser.runtime.lastError.message || ''

        // Check if error is due to browser being busy (can retry)
        if (errorMsg.includes('cannot be edited right now') ||
            errorMsg.includes('dragging') ||
            errorMsg.includes('busy')) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.warn(`[BackgroundTabService] ⏳ Tab busy, retrying move in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`)

          setTimeout(() => {
            this.moveTabWithRetry(tabId, attempt + 1)
          }, delay)
          return
        }

        // Other errors - don't retry
        console.error('[BackgroundTabService] ❌ move error (not retrying):', errorMsg)
        return
      }

      console.log(`[BackgroundTabService] 🎉 Success! Tab#${tabId} moved to position ${movedTab?.index}`)

      // ✅ Update tab's lastAccessed timestamp to now and persist to storage
      try {
        const snapshot = await tabStorageItem.getValue()
        if (snapshot?.tabs) {
          const now = Date.now()
          const updatedTabs = (Array.isArray(snapshot.tabs) ? snapshot.tabs : Object.values(snapshot.tabs as Record<string, unknown>))
            .map((t: unknown) => {
              const tab = t as ClassifiedTab
              return tab.id === tabId ? { ...tab, lastAccessed: now } : tab
            })

          const updatedSnapshot = new TabsSnapshot(updatedTabs, snapshot.isGrouped ?? false, new Date().toISOString())
          await tabStorageItem.setValue(updatedSnapshot)

          console.log(`[BackgroundTabService] ⏰ Updated tab#${tabId} lastAccessed to ${new Date(now).toISOString()}`)
          console.log(`[BackgroundTabService] 📤 Persisted to storage → TabStore will sync via initStorageSync()`)
        }
      } catch (err) {
        console.error('[BackgroundTabService] ❌ Error updating lastAccessed:', err instanceof Error ? err.message : err)
      }
    })
  }
}
