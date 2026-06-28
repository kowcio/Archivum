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

import { TabRow } from '@/entrypoints/options/models/TabRow.ts'
import { AgeClassification } from '@/models/AgeClassification.ts'
import { getStorageThresholds } from '@/store/appStore.ts'
import { AppThresholds } from '@/models/AppThresholds'
import { browser } from 'wxt/browser'
import type { Browser } from 'wxt/browser'
import { MOCK_TABS } from '@/utils/mockTabData'
import { APP_DEFAULTS } from '@/constants'
import dayjs from "dayjs";

export class BackgroundTabService {
  /**
   * Get array of possible plugin-created group titles based on threshold labels.
   * Titles follow pattern: "Label+ (count)"
   */
  private static getPluginGroupTitles(): string[] {
    return APP_DEFAULTS.THRESHOLDS.presets.map(p => p.label)
  }

  static async getThresholds(): Promise<AppThresholds> {
    return await getStorageThresholds()
  }

    /**
     * Applies mock lastAccessed overrides to raw tabs (debug).
     * When a mock override exists for a tabId, it replaces tab.lastAccessed.
     * Overrides persist so tab ages stay correct across page refreshes.
     *
     * OPTIMIZATION: Early return if no overrides, lazy load only if needed.
     * Avoids storage reads in production environments (no mock data).
     */
    private static async applyMockOverrides(tabs: { id?: number; lastAccessed?: number }[]): Promise<void> {
      try {
        const storageData = await browser.storage.local.get(['mock_overrides'])
        const overrides: Record<number, number> = (storageData?.mock_overrides ?? {}) as Record<number, number>
        const ids = Object.keys(overrides)

        if (ids.length === 0) {
          console.log('[BackgroundTabService] ✓ No mock overrides (production path)')
          return
        }

        console.log('[BackgroundTabService] 📥 Applying mock overrides to', ids.length, 'tabs')

        for (const tab of tabs) {
          if (tab.id != null && overrides[tab.id] != null) {
            tab.lastAccessed = overrides[tab.id]
          }
        }
        console.log('[BackgroundTabService] ✅ Applied mock overrides to', ids.length, 'tabs')
      } catch (err) {
        console.warn('[BackgroundTabService] ⚠️ Failed to read mock overrides:', err)
      }
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
       await this.applyMockOverrides(rawTabs)

       const rows = TabRow.fromTabs(rawTabs, thresholds)
       const activeLevels = thresholds.active()
       const levelTabIds: number[][] = Array.from({ length: activeLevels.length }, () => [])
       const freshTabIds: number[] = []

       // Build age map for sorting tabs within each level
       const ageMap = new Map<number, number>()
       for (const row of rows) {
         if (row.id != null) ageMap.set(row.id, row.lastAccessDays ?? 0)
       }

       // Classify tabs into age levels, collecting fresh tabs separately
       for (const row of rows) {
         if (row.id == null) continue
         const c = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)
         if (c.index === 0) {
           // Fresh tabs — stay ungrouped, will move to rightmost later
           freshTabIds.push(row.id)
         } else if (c.index > 0 && c.index <= activeLevels.length) {
           levelTabIds[c.index - 1].push(row.id)
         }
       }

       // Sort tabs within each level by age (oldest first = highest lastAccessDays first)
       for (const ids of levelTabIds) {
         ids.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
       }

       // ── Reorder tabs so visual order matches: oldest→youngest groups left-to-right, fresh far right ──
       // Build ordered array: oldest level first (Month+ → left), youngest level last (Week+ → right), fresh at end
       const orderedTabIds: number[] = []
       for (let i = activeLevels.length - 1; i >= 0; i--) {
         orderedTabIds.push(...levelTabIds[i])
       }
       orderedTabIds.push(...freshTabIds)

       // Move all tabs into position in bulk — oldest at index 0 (leftmost), fresh at highest index (rightmost)
       if (orderedTabIds.length > 0) {
         try {
           await browser.tabs.move(orderedTabIds, { index: 0 })
           console.log(`[BackgroundTabService] ✅ Reordered ${orderedTabIds.length} tabs (oldest→youngest→fresh)`)
         } catch (err) {
           console.warn('[BackgroundTabService] ⚠️ Tab reorder failed, skipping:', err)
         }
       }

       // Create groups from oldest→youngest (left→right).
       // After reorder, Month+ tabs are at lowest indexes, so Month+ group appears leftmost.
       let groupsCreated = 0
       for (let i = activeLevels.length - 1; i >= 0; i--) {
         const level = activeLevels[i]
         const tabIds = levelTabIds[i]

         if (tabIds.length === 0) continue

         try {
           const groupId = await (browser.tabs as any).group({ tabIds })
           await (browser.tabGroups as any).update(groupId, {
             title: `${level.label} (${tabIds.length})`,
             color: level.color,
             collapsed: true
           })
           groupsCreated++
           console.log(`[BackgroundTabService] ✅ Created group "${level.label}" with ${tabIds.length} tabs`)
         } catch (err) {
           console.error(`[BackgroundTabService] Failed to create group "${level.label}":`, err)
         }
       }

       // Note: fresh tabs were already moved to rightmost in the reorder step above.
       // No separate move needed.

       console.log(`[BackgroundTabService] ✅ Created ${groupsCreated} groups (oldest on left, youngest on right) + ${freshTabIds.length} fresh tabs at far right`)
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
       // 🎯 Filter: Only modify tabs IN plugin-created groups
       const inPluginGroup = await this.isInPluginGroup(tabId)
       if (!inPluginGroup) {
         console.log(`[BackgroundTabService] ⏭️ Tab#${tabId} not in plugin group → skip modification`)
         return
       }

       // 🧩 Ungroup BEFORE move — removes tab from group (Chrome/Edge).
       // IMPORTANT: Use browser.tabs.ungroup([tabId]) NOT browser.tabs.update({ groupId: -1 })
       // The update() API does NOT accept groupId — it silently ignores it.
       // Only ungroup() actually removes a tab from its group.
       // Firefox has no ungroup API, so the catch block handles that gracefully.
       try { await (browser.tabs as any).ungroup([tabId]) } catch { /* Firefox or already ungrouped */ }

      // ➡️ Move to rightmost with retry — tabs may be locked during user drag
      const maxRetries = 2
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await browser.tabs.move(tabId, { index: -1 })
          console.log(`[BackgroundTabService] ✅ Tab#${tabId} activated → timestamp saved + ungrouped + moved to rightmost`)
          return
        } catch (err: any) {
          // If tabs cannot be edited (user dragging), retry with backoff
          if (err?.message?.includes('cannot be edited') && attempt < maxRetries - 1) {
            const delayMs = 100 * (attempt + 1)
            await new Promise(r => setTimeout(r, delayMs))
            continue
          }
          // Last attempt or unrelated error — log and skip
          if (attempt === maxRetries - 1) {
            console.warn(`[BackgroundTabService] ⚠️ Tab#${tabId} move failed after ${maxRetries} retries:`, err)
          }
          break
        }
      }
    } catch (err) {
      console.error(`[BackgroundTabService] ❌ onTabActivated error:`, err)
    }
  }

   /**
    * Queries tabs from current window.
    * Applies mock overrides if they exist (for debug/testing).
    * UI displays tabs with mocked lastAccessed when in debug mode.
    */
   static async getTabs(): Promise<Browser.tabs.Tab[]> {
     const tabs = await browser.tabs.query({ currentWindow: true })
     await this.applyMockOverrides(tabs)
     return tabs
   }

   /**
    * Creates mock tabs using realistic data from mockTabData.ts.
    * Automatically sets mock overrides for each tab based on daysAgo to enable grouping.
    *
    * Flow:
    * 1. Create N tabs from MOCK_TABS array
    * 2. Build overrides map: tabId → (now - daysAgo * 24h)
    * 3. Set overrides in storage for applyMockOverrides() to use
    * 4. Return all tabs (mock + existing)
    */
   static async createMockTabs(): Promise<Browser.tabs.Tab[]> {
     const tabIds: number[] = []
     const DAY_MS = 86400000 // 24 hours in milliseconds
     const now = Date.now()

     console.log(`[BackgroundTabService] createMockTabs: starting...`)

     // Create tabs using realistic mock data
     for (let i = 0; i < MOCK_TABS.length; i++) {
       const mock = MOCK_TABS[i]
       try {
         const tab = await browser.tabs.create({
           url: mock.url,
           active: false,
         })
         if (tab.id != null) {
           const data = dayjs(tab.lastAccessed).toISOString();
           //Pusty title to tylko efekt uboczny asynchronicznego renderowania strony.
           console.log(`Tab created[${i}]: ${String(tab.id).padEnd(8)} groupId=${tab.groupId} data=${data} "${tab.title}"`)
           tabIds.push(tab.id)
         }
       } catch {
         // Some URLs may fail — create simpler tabs as fallback
         const tab = await browser.tabs.create({ url: `https://example.com/mock-${i}`, active: false })
         if (tab.id != null) tabIds.push(tab.id)
       }
     }

     console.log(`[BackgroundTabService] Created ${tabIds.length} tabs, now setting overrides...`)

     // Brief delay to let tabs start loading
     await new Promise(r => setTimeout(r, 500))

     // Build overrides map: tabId → lastAccessed timestamp based on daysAgo
     const overridesMap: Record<number, number> = {}
     for (let i = 0; i < tabIds.length && i < MOCK_TABS.length; i++) {
       const tabId = tabIds[i]
       const daysAgo = MOCK_TABS[i].daysAgo ?? 1
       overridesMap[tabId] = now - daysAgo * DAY_MS
       // console.log(`[BackgroundTabService] Mock override: tab#${tabId} → ${daysAgo} days ago`)
     }

     // Set overrides in browser.storage.local directly (ensures cross-context sync)
     try {
       console.log(`[BackgroundTabService] About to set ${Object.keys(overridesMap).length} overrides...`)
       await browser.storage.local.set({ mock_overrides: overridesMap })
       console.log(`[BackgroundTabService] ✅ Set ${Object.keys(overridesMap).length} mock overrides via browser.storage.local`)
     } catch (err) {
       console.error(`[BackgroundTabService] ❌ Failed to set overrides:`, err)
     }

     // Extra delay to ensure storage is persisted/synchronized (WXT MV3 constraint)
     console.log(`[BackgroundTabService] Waiting 1s for storage sync...`)
     await new Promise(r => setTimeout(r, 1000))
     console.log(`[BackgroundTabService] Storage sync complete`)

     // Re-query tabs to get full tab objects
     const allTabs = await browser.tabs.query({ currentWindow: true })
     console.log(`[BackgroundTabService] Created ${tabIds.length} mock tabs, queried ${allTabs.length} total tabs`)


     return allTabs
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
       const pluginTitles = this.getPluginGroupTitles()
       return pluginTitles.some(title => group.title.startsWith(title))
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

       const groups = await (browser.tabGroups as any).query({ windowId: (browser.windows as any).WINDOW_ID_CURRENT })
       const pluginTitles = this.getPluginGroupTitles()

       return groups.some((group: any) =>
         pluginTitles.some(title => group.title.startsWith(title))
       )
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

        // Get group info if tab is grouped
        let groupId: number | null = null
        let groupTitle: string | null = null

        if (browser.tabGroups != null && tab.groupId != null && tab.groupId !== -1) {
          groupId = tab.groupId
          try {
            const group = await (browser.tabGroups as any).get(groupId)
            groupTitle = group.title
          } catch {
            // Group query failed, skip update
          }
        }

        // Close the tab
        await browser.tabs.remove(tabId)
        console.log(`[BackgroundTabService] ✅ Closed tab#${tabId}`)

        // If tab was in a plugin group, update group title with new count
        if (groupId != null && groupTitle != null && browser.tabGroups != null) {
          try {
            // Count remaining tabs in group
            const groupTabs = await browser.tabs.query({ groupId })
            const newCount = groupTabs.length

            // Update title with new count (extract label prefix)
            const match = groupTitle.match(/^(.+?)\s*\(\d+\)$/)
            const labelPrefix = match ? match[1] : groupTitle

            if (newCount > 0) {
              await (browser.tabGroups as any).update(groupId, {
                title: `${labelPrefix} (${newCount})`
              })
              console.log(`[BackgroundTabService] ✅ Updated group title to "${labelPrefix} (${newCount})"`)
            } else {
              // Remove group if no tabs left
              await (browser.tabs as any).ungroup(tabId)
              console.log(`[BackgroundTabService] ✅ Removed empty group`)
            }
          } catch (err) {
            console.warn(`[BackgroundTabService] ⚠️ Failed to update group title:`, err)
          }
        }

        return null
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[BackgroundTabService] ❌ closeTab error:`, msg)
        return msg
      }
    }

   /**
    * Sort all tabs alphabetically by domain (A→Z).
    * Strips `www.` and protocol before sorting, e.g. `https://www.EXAMPLE.com/path` sorts as `example.com`.
    * Ungrouped and grouped tabs are both reordered — existing groups are preserved.
    */
   static async sortGroupsByDomain(): Promise<number> {
     console.log('[BackgroundTabService] sortGroupsByDomain...')
     try {
       const tabs = await browser.tabs.query({ currentWindow: true })
       if (tabs.length === 0) return 0

       const getSortKey = (url?: string): string => {
         try {
           return new URL(url ?? '').hostname.replace(/^www\d?\./i, '')
         } catch {
           return ''
         }
       }

       const sorted = [...tabs].sort((a, b) =>
         getSortKey(a.url).localeCompare(getSortKey(b.url))
       )

       const ids = sorted.map(t => t.id).filter((id): id is number => id != null)
       await browser.tabs.move(ids, { index: 0 })

       console.log(`[BackgroundTabService] ✅ Sorted ${ids.length} tabs by domain`)
       return ids.length
     } catch (err) {
       console.error('[BackgroundTabService] ❌', err)
       return 0
     }
   }
}
