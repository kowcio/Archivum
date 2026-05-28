/**
 * BackgroundTabService — tab operations for the background service worker.
 *
 * Runs WITHOUT Pinia (background has its own isolated VM).
 * Reads config from browser.storage, operates directly on browser.tabs + scripting APIs.
 * Writes tab snapshots to browser.storage so UI contexts can sync via TabStore.initStorageSync().
 *
 * Flow:
 *   browser.alarms → loadAndMarkTabs() → browser.storage (snapshot)
 *                                       → browser.scripting (visual marks)
 *   browser.tabs.onActivated → removeLBracketForTab() → browser.scripting
 */

import browser from 'webextension-polyfill'
import { TabDots } from '@/services/TabDots'
import { ClassifiedTabFactory } from '@/models/tabs/ClassifiedTab'
import { TabRow } from '@/models/tabs/TabRow'
import { AgeClassification } from '@/models/tabs/AgeClassification'
import StorageService from '@/services/StorageService'
import { APP_DEFAULTS, APP_CONSTANTS } from '@/constants'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { TabsSnapshot } from '@/models/tabs/TabsSnapshot'
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'

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
   * Loads all current-window tabs, marks old ones with L-bracket overlay,
   * then persists the snapshot to storage so UI contexts can stay in sync.
   *
   * Called by the daily alarm. OffscreenCanvas is available in MV3 service workers.
   */
  static async loadAndMarkTabs(): Promise<void> {
    console.log('[BackgroundTabService] Starting loadAndMarkTabs...')
    try {
      const rawTabs = await browser.tabs.query({ currentWindow: true })
      const thresholds = await this.getThresholds()
      const classified: ClassifiedTab[] = ClassifiedTabFactory.fromTabs(rawTabs)
      const rows = TabRow.fromTabs(classified, thresholds)

      await Promise.all(
        rows.map(async (row) => {
          if (row.id == null) return
          const classification = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)
          if (classification.isFresh) return

          const rawTab = rawTabs.find(t => t.id === row.id)
          const rawFaviconUrl = rawTab?.favIconUrl?.startsWith('data:')
            ? undefined
            : rawTab?.favIconUrl

          try {
            const faviconDataUrl = rawFaviconUrl
              ? await TabDots.fetchFaviconDataUrl(rawFaviconUrl)
              : null
            const renderedUrl = await TabDots.renderLBracketDataUrl(faviconDataUrl, classification.color)

            await browser.scripting.executeScript({
              target: { tabId: row.id },
              func: TabDots.applyLBracketPageScript,
              args: [renderedUrl],
            })

            // Update classified tab with mark state
            const idx = classified.findIndex(t => t.id === row.id)
            if (idx !== -1) {
              classified[idx] = {
                ...classified[idx],
                isMarked: true,
                ageIndex: classification.index,
                markedFaviconDataUrl: renderedUrl,
              }
            }
          } catch (err) {
            // executeScript fails on restricted pages (chrome://, extension pages) — silent
            console.debug(`[BackgroundTabService] mark tab#${row.id}:`, err instanceof Error ? err.message : err)
          }
        }),
      )

      // Persist snapshot to storage → TabStore.initStorageSync() in UI contexts picks this up
      const snapshot = new TabsSnapshot(classified, new Date().toISOString())
      await browser.storage.local.set({ [APP_DEFAULTS.TAB_HISTORY_KEY]: snapshot })

      console.log(`[BackgroundTabService] ✅ Loaded & marked ${classified.length} tabs`)
    } catch (err) {
      console.error('[BackgroundTabService] ❌ loadAndMarkTabs error:', err instanceof Error ? err.message : err)
    }
  }

  /**
   * Removes the L-bracket favicon overlay from a single tab (called on tab activation).
   * Purely visual — does not modify storage (UI context handles its own store update).
   */
  static async removeLBracketForTab(tabId: number): Promise<void> {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        func: TabDots.removeLBracketPageScript,
        args: [],
      })
      console.log(`[BackgroundTabService] Removed L-bracket from tab#${tabId}`)
    } catch (err) {
      console.debug(`[BackgroundTabService] removeLBracket tab#${tabId}:`, err instanceof Error ? err.message : err)
    }
  }
}

