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
import { getStorageThresholds, mockOverrides, appStateStorage } from '@/store/appStore.ts'
import { AppThresholds } from '@/models/AppThresholds'
import { browser } from 'wxt/browser'
import type { Browser } from 'wxt/browser'
import { MOCK_TABS } from '@/utils/mockTabData'
import { APP_DEFAULTS } from '@/constants'

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
         const overrides = await mockOverrides.getValue()
         const ids = Object.keys(overrides)

         if (ids.length === 0) {
           return
         }

         for (const tab of tabs) {
           if (tab.id != null) {
             const numericOverride = (overrides as Record<number, number>)[tab.id]
             const stringOverride = (overrides as Record<string, number>)[String(tab.id)]
             const override = numericOverride ?? stringOverride
             if (override != null) {
               tab.lastAccessed = override
             }
           }
         }
        } catch (err) {
          console.warn('[BackgroundTabService] ⚠️ Failed to read mock overrides:', err)
        }
     }

      static async groupTabsByAge(): Promise<number> {
      try {
        const hasTabGroups = browser.tabGroups != null
        if (!hasTabGroups) {
          return 0
        }

       const rawTabs = await browser.tabs.query({ currentWindow: true })
       const thresholds = await this.getThresholds()
       const appState = await appStateStorage.getValue()
       const sortByDomainInGroups = appState?.sortSettings?.sortByDomainInGroups ?? true

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

       // Helper: Extract domain from URL
       const getDomain = (url?: string): string => {
         try {
           return new URL(url ?? '').hostname.replace(/^www\d?\./i, '')
         } catch {
           return ''
         }
       }

       // Build domain map for sorting by domain within levels (if enabled)
       const domainMap = new Map<number, string>()
       if (sortByDomainInGroups) {
         for (const row of rows) {
           if (row.id != null) domainMap.set(row.id, getDomain(row.url))
         }
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

       // Sort tabs within each level by domain (A→Z), then by age (oldest first) — only if enabled
       if (sortByDomainInGroups) {
         for (const ids of levelTabIds) {
           ids.sort((a, b) => {
             const domainA = domainMap.get(a) ?? ''
             const domainB = domainMap.get(b) ?? ''
             const domainCompare = domainA.localeCompare(domainB)
             if (domainCompare !== 0) return domainCompare
             return (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0)
           })
         }
       } else {
         // If not sorting by domain, at least sort by age (oldest first)
         for (const ids of levelTabIds) {
           ids.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
         }
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
          } catch (err) {
            console.error('[BackgroundTabService] ⚠️ Tab reorder failed, skipping:', err)
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
              collapsed: true,
              index:groupsCreated
            })
            groupsCreated++
          } catch (err) {
            console.error(`[BackgroundTabService] Failed to create group "${level.label}":`, err)
          }
        }

        // Note: fresh tabs were already moved to rightmost in the reorder step above.
        // No separate move needed.

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
     } catch (err) {
       console.error('[BackgroundTabService] ❌ ungroupAll error:', err)
     }
   }

    static async onTabActivated(tabId: number): Promise<void> {
      // 🎯 Filter: Only modify tabs IN plugin-created groups
      const inPluginGroup = await this.isInPluginGroup(tabId)
      if (!inPluginGroup) {
        return
      }

      // 📝 Get current tab + group info (guaranteed to exist after isInPluginGroup check)
      const tab = await browser.tabs.get(tabId)
      const groupId = tab.groupId as number
      const groupTitle = (await browser.tabGroups.get(groupId)).title

      // 🧩 Ungroup the tab, then move to rightmost — with retry
      const RETRIES = 3
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        try {
          await (browser.tabs as any).ungroup([tabId])
          await browser.tabs.move(tabId, { index: -1 })
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
          const groupTabs = await browser.tabs.query({ groupId })
          const labelPrefix = groupTitle!.match(/^(.+?)\s*\(\d+\)$/)?.[1] || groupTitle
          await (browser.tabGroups as any).update(groupId, {
            title: `${labelPrefix} (${groupTabs.length})`
          })
          return
        }

        // Retry with backoff
        if (attempt < RETRIES - 1) {
          await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
        }
      }

      console.warn(`[BackgroundTabService] ⚠️ Tab#${tabId} still grouped after ${RETRIES} retries`)
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

      // Create tabs using realistic mock data
      for (let i = 0; i < MOCK_TABS.length; i++) {
        const mock = MOCK_TABS[i]
        try {
          const tab = await browser.tabs.create({
            url: mock.url,
            active: false,
          })
          if (tab.id != null) {
            tabIds.push(tab.id)
          }
        } catch {
          // Some URLs may fail — create simpler tabs as fallback
          const tab = await browser.tabs.create({ url: `https://example.com/mock-${i}`, active: false })
          if (tab.id != null) tabIds.push(tab.id)
        }
      }

      // Brief delay to let tabs start loading
      await new Promise(r => setTimeout(r, 500))

      // Build overrides map: tabId → lastAccessed timestamp based on daysAgo
      const overridesMap: Record<number, number> = {}
      for (let i = 0; i < tabIds.length && i < MOCK_TABS.length; i++) {
        const tabId = tabIds[i]
        const daysAgo = MOCK_TABS[i].daysAgo ?? 1
        overridesMap[tabId] = now - daysAgo * DAY_MS
      }

      // Set overrides via WXT storage (unified approach with setMockOverrides action)
      try {
        await mockOverrides.setValue(overridesMap)
      } catch (err) {
        console.error(`[BackgroundTabService] ❌ Failed to set overrides:`, err)
      }

      // Extra delay to ensure storage is persisted/synchronized (WXT MV3 constraint)
      await new Promise(r => setTimeout(r, 1000))

      // Re-query tabs to get full tab objects
      const allTabs = await browser.tabs.query({ currentWindow: true })


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
     * Focus/activate a tab and bring its window to foreground
     * User can then investigate the tab content before closing manually
     */
    static async focusTab(tabId: number): Promise<string | null> {
      try {
        const tab = await browser.tabs.get(tabId)

        // Activate the tab (brings it to focus)
        await browser.tabs.update(tabId, { active: true })

        // Bring window to foreground if tab is in a window
        if (tab.windowId != null) {
          await (browser.windows as any).update(tab.windowId, { focused: true })
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
    * Sort all tabs alphabetically by domain (A→Z).
    * Strips `www.` and protocol before sorting, e.g. `https://www.EXAMPLE.com/path` sorts as `example.com`.
    * Ungrouped and grouped tabs are both reordered — existing groups are preserved.
    */
   static async sortGroupsByDomain(): Promise<number> {
     console.log('[BackgroundTabService] sortGroupsByDomain...')
     try {
       const tabs = await browser.tabs.query({ currentWindow: true })
       if (tabs.length === 0) return 0

       // Separate grouped and ungrouped tabs
       const groupedTabs = tabs.filter(t => t.groupId != null && t.groupId !== -1)
       const ungroupedTabs = tabs.filter(t => t.groupId == null || t.groupId === -1)

       console.log(`[BackgroundTabService] Grouped: ${groupedTabs.length}, Ungrouped: ${ungroupedTabs.length}`)

       const getSortKey = (url?: string): string => {
         try {
           return new URL(url ?? '').hostname.replace(/^www\d?\./i, '')
         } catch {
           return ''
         }
       }

       // Sort ungrouped tabs by domain, then by lastAccessed
       const sortedUngrouped = [...ungroupedTabs].sort((a, b) => {
         const domainA = getSortKey(a.url)
         const domainB = getSortKey(b.url)

         // First sort by domain alphabetically
         const domainCompare = domainA.localeCompare(domainB)
         if (domainCompare !== 0) return domainCompare

         // Within same domain, sort by lastAccessed (newest first = higher values first)
         const timeA = a.lastAccessed || 0
         const timeB = b.lastAccessed || 0
         return timeB - timeA
       })

       // Calculate the index where ungrouped tabs should start
       // This is after all grouped tabs
       const startIndex = groupedTabs.length

       // Move ungrouped tabs to their sorted positions, starting after all groups
       const ungroupedIds = sortedUngrouped.map(t => t.id).filter((id): id is number => id != null)
       if (ungroupedIds.length > 0) {
         await browser.tabs.move(ungroupedIds, { index: startIndex })
         console.log(`[BackgroundTabService] ✅ Moved ${ungroupedIds.length} ungrouped tabs starting at index ${startIndex}`)
       }

       console.log(`[BackgroundTabService] ✅ Sorted ${ungroupedIds.length} ungrouped tabs by domain then lastAccessed`)
       return ungroupedIds.length
     } catch (err) {
       console.error('[BackgroundTabService] ❌', err)
       return 0
     }
   }

}
