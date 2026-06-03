/**
 * BackgroundTabService — tab operations for the background service worker.
 *
 * Runs WITHOUT Pinia (background has its own isolated VM).
 * Reads config from chrome.storage, operates directly on chrome.tabs + scripting APIs.
 * Writes tab snapshots to chrome.storage so UI contexts can sync via TabStore.initStorageSync().
 *
 * Flow:
 *   chrome.alarms → loadAndMarkTabs() → chrome.storage (snapshot)
 *                                      → LBracketService (visual marks)
 *   chrome.tabs.onActivated → removeLBracketForTab() → LBracketService
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
   * Groups tabs by age using Chrome tab groups API, then persists snapshot.
   * Called by the daily alarm.
   *
   * Creates age-based groups: Old / Middle / Young (no emojis, threshold-based titles).
   * Moves groups to the left so tabs flow: oldest (left) → youngest (right).
   */
  static async groupTabsByAge(): Promise<void> {
    console.log('[BackgroundTabService] Starting groupTabsByAge...')
    try {
      type ChromeAPI = {
        chrome?: {
          tabs?: { group?: (o: { tabIds: number[] }) => Promise<number> }
          tabGroups?: {
            update?: (id: number, o: { title?: string; color?: string; collapsed?: boolean }) => Promise<void>
            move?: (id: number, o: { index: number }) => Promise<void>
          }
        }
      }
      const chromeApi = (globalThis as unknown as ChromeAPI).chrome
      if (!chromeApi?.tabs?.group || !chromeApi?.tabGroups?.update) {
        console.log('[BackgroundTabService] Chrome tab grouping API not available (Firefox?)')
        return
      }

      // Use chrome.tabs.query instead of browser polyfill for ESM compatibility
      const rawTabs = await chrome.tabs.query({ currentWindow: true })
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

      const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
        if (!ids.length) return null
        try {
          const id = await chromeApi.tabs!.group!({ tabIds: ids })
          await chromeApi.tabGroups!.update!(id, { title, color, collapsed: false })
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
      if (chromeApi.tabGroups?.move) {
        for (const id of [oldGroupId, middleGroupId, youngGroupId]) {
          if (id !== null) {
            try {
              await chromeApi.tabGroups.move(id, { index: 0 })
            } catch (err) {
              console.debug('[BackgroundTabService] moveGroup error:', err)
            }
          }
        }
      }

      const snapshot = new TabsSnapshot(classified, true, new Date().toISOString())
      await tabStorageItem.setValue(snapshot)

      console.log(`[BackgroundTabService] ✅ Grouped ${classified.length} tabs into ${[oldGroupId, middleGroupId, youngGroupId].filter(id => id !== null).length} groups`)
    } catch (err) {
      console.error('[BackgroundTabService] ❌ groupTabsByAge error:', err instanceof Error ? err.message : err)
    }
  }

  /**
   * Moves an activated tab from an old group to the rightmost position as a fresh tab.
   * Called when user clicks on a tab in an old/middle/young group.
   *
   * Ungroups the tab and moves it to the rightmost position (youngest/freshest).
   *
   * ⚠️ Chrome-specific: Uses native chrome.tabs API because Tab Groups are not in webextension-polyfill
   * ⚠️ Includes retry mechanism for "Tabs cannot be edited right now" errors
   */
  static async moveActivatedTabToFresh(tabId: number): Promise<void> {
    console.log(`[BackgroundTabService] 🔧 moveActivatedTabToFresh called for tab#${tabId}`)

    try {
      // Check if chrome API is available (Chrome/Chromium only, not Firefox)
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        console.warn('[BackgroundTabService] ⚠️ chrome.tabs not available (Firefox or non-Chrome browser)')
        return
      }

      console.log(`[BackgroundTabService] 🔍 Getting tab#${tabId} info...`)

      // Use native chrome.tabs.get to get proper groupId support
      chrome.tabs.get(tabId, (tab: chrome.tabs.Tab | undefined) => {
        if (chrome.runtime.lastError) {
          console.error('[BackgroundTabService] ❌ chrome.tabs.get error:', chrome.runtime.lastError.message)
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

        // Retry mechanism for "Tabs cannot be edited right now" errors
        this.ungroupWithRetry(tabId, 0)
      })
    } catch (err) {
      console.error(`[BackgroundTabService] ❌ Unexpected error in moveActivatedTabToFresh:`, err)
    }
  }

  /**
   * Helper: Ungroup tab with retry mechanism (exponential backoff)
   * Handles race conditions when Chrome is busy with tab operations
   */
  private static ungroupWithRetry(tabId: number, attempt: number): void {
    const maxAttempts = 5
    const baseDelay = 100 // ms

    if (attempt >= maxAttempts) {
      console.error(`[BackgroundTabService] ❌ Failed to ungroup tab#${tabId} after ${maxAttempts} attempts`)
      return
    }

    chrome.tabs.ungroup(tabId, () => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || ''

        // Check if error is due to Chrome being busy (can retry)
        if (errorMsg.includes('cannot be edited right now') ||
            errorMsg.includes('dragging') ||
            errorMsg.includes('busy')) {
          const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
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
   */
  private static moveTabWithRetry(tabId: number, attempt: number): void {
    const maxAttempts = 5
    const baseDelay = 100 // ms

    if (attempt >= maxAttempts) {
      console.error(`[BackgroundTabService] ❌ Failed to move tab#${tabId} after ${maxAttempts} attempts`)
      return
    }

    chrome.tabs.move(tabId, { index: -1 }, (movedTab: chrome.tabs.Tab | undefined) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message || ''

        // Check if error is due to Chrome being busy (can retry)
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
    })
  }
}
