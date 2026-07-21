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
import {appStateStorage, getStorageThresholds, mockOverrides} from '@/store/appStore.ts'
import {AppThresholds} from '@/models/AppThresholds'
import type {Browser} from 'wxt/browser'
import {browser} from 'wxt/browser'
import {MOCK_TABS} from '@/utils/mockTabData'
import {APP_DEFAULTS} from '@/constants'
import {getCurrentTime} from '@/utils/testTime'

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
   static async getGroups(getAll: boolean = false): Promise<Array<{ id: number; title: string; index?: number; color?: string; collapsed?: boolean }>> {
     try {
       if (browser.tabGroups == null) return []

        const allGroups = await (browser.tabGroups as any)
          .query({ windowId: (browser.windows as any).WINDOW_ID_CURRENT })
        // ✅ Safety filter: remove groups without id (shouldn't happen but defensive)
        const validGroups = allGroups.filter((g: any) => g.id != null)
        validGroups.sort((a: any, b: any) => (a.index ?? -1) - (b.index ?? -1))

       //return all the groups i.ex to check logic in tests
       if (getAll) return validGroups

       // Filter: keep only plugin-created groups
       // ✅ Simplified: check if title STARTS WITH any threshold label
       // This avoids fragile regex and handles edge cases (empty groups, malformed titles)
       return validGroups.filter((group: any) =>
         this.getPluginGroupTitles().some(title => group.title.startsWith(title))
       )
     } catch (err) {
       console.warn('[BackgroundTabService] ⚠️ Failed to query plugin groups:', err)
       return []
     }
   }

  /**
   * Build label → groupId map for quick group lookups.
   * Used by updateTabByAge() to determine target group for each tab.
   *
   * Example: { "Week+": 5, "Month+": 8, "2 Weeks+": 6 }
   * ✅ Simplified: find matching threshold label instead of parsing regex
   */
   private static async getPluginGroupMap(): Promise<Map<string, number>> {
     const groups = await this.getGroups()
     const map = new Map<string, number>()
     const pluginTitles = this.getPluginGroupTitles()

     for (const group of groups) {
       // ✅ Safety check: group must have id
       if (group.id == null) continue
       // ✅ Find which threshold label this group starts with
       const matchingLabel = pluginTitles.find(title => group.title.startsWith(title))
       if (matchingLabel) {
         map.set(matchingLabel, group.id)
       }
     }

     return map
   }

  static async getThresholds(): Promise<AppThresholds> {
    return await getStorageThresholds()
  }

     /**
      * Applies mock lastAccessed overrides to raw tabs (debug/testing only).
      *
      * Called by: getTabs() when mocks are detected in storage
      *
      * When a mock override exists for a tabId, it replaces tab.lastAccessed in-memory.
      * The real browser tab is never modified — only the in-memory object used by grouping logic.
      *
      * Overrides persist in storage so tab ages stay consistent across page refreshes.
      *
      * OPTIMIZATION: Only called if overrides storage has entries (zero overhead in production).
      */
      private static async applyMockOverrides(tabs: { id?: number; lastAccessed?: number }[]): Promise<void> {
        try {
          const overrides = await mockOverrides.getValue()

          // This method is only called if overrides exist, but double-check for safety
          if (!overrides || Object.keys(overrides).length === 0) {
            return
          }

          for (const tab of tabs) {
            if (tab.id != null) {
              const numericOverride = (overrides as Record<number, number>)[tab.id]
              const stringOverride = (overrides as Record<string, number>)[String(tab.id)]
              const override = numericOverride ?? stringOverride
              if (override != null) {
                tab.lastAccessed = override  // ← Mutates in-memory tab object
              }
            }
          }
         } catch (err) {
           console.warn('[BackgroundTabService] ⚠️ Failed to apply mock overrides:', err)
         }
      }

   static async groupTabsByAge(): Promise<number> {
        try {
          if (browser.tabGroups == null) return 0

         // 🧹 First, ungroup all existing plugin-created groups
         // This ensures clean slate when thresholds change or re-grouping happens
         await this.ungroupAllTabs()

         const rawTabs = await this.getTabs()
         const thresholds = await this.getThresholds()
         const currentTime = await getCurrentTime()

        const rows = TabRow.fromTabs(rawTabs, thresholds, currentTime)
        const activeLevels = thresholds.active()
        const levelTabIds: number[][] = Array.from({ length: activeLevels.length }, () => [])
        const freshTabIds: number[] = []

        // Build age map
        const ageMap = new Map<number, number>()
        for (const row of rows) {
          if (row.id != null) ageMap.set(row.id, row.lastAccessDays ?? 0)
        }

        // Classify tabs into age levels
        for (const row of rows) {
          if (row.id == null) continue
          const c = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)
          if (c.index === 0) {
            freshTabIds.push(row.id)
          } else if (c.index > 0 && c.index <= activeLevels.length) {
            levelTabIds[c.index - 1].push(row.id)
          }
        }

        // Sort each level by age (oldest first)
        for (const ids of levelTabIds) {
          ids.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
        }

        // Build ordered array by reversing the level-to-tabs mapping
        // levelTabIds is ordered [Week+, 2Weeks+, Month+, Quarter+, Years]
        // We need [Years, Quarter+, Month+, 2Weeks+, Week+]
        const reversedTabIds: number[] = []
        for (let i = levelTabIds.length - 1; i >= 0; i--) {
          reversedTabIds.push(...levelTabIds[i])
        }

        const orderedTabIds = [
          ...reversedTabIds,
          ...freshTabIds
        ]

        // Move all tabs into position
        if (orderedTabIds.length > 0) {
          try {
            await browser.tabs.move(orderedTabIds, { index: 0 })
          } catch (err) {
            console.error('[BackgroundTabService] ⚠️ Tab reorder failed, skipping:', err)
          }
        }

        // Create groups from oldest→youngest by iterating activeLevels backwards
        let groupsCreated = 0
        for (let i = activeLevels.length - 1; i >= 0; i--) {
          const tabIds = levelTabIds[i]
          if (tabIds.length === 0) continue

          try {
            const groupId = await (browser.tabs as any).group({ tabIds })
            await (browser.tabGroups as any).update(groupId, {
              title: `${activeLevels[i].label} (${tabIds.length})`,
              color: activeLevels[i].color,
              collapsed: true,
            })
            groupsCreated++
          } catch (err) {
            console.error(`[BackgroundTabService] Failed to create group "${activeLevels[i].label}":`, err)
          }
        }

        return groupsCreated
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

       const rawTabs = await this.getTabs()
       const thresholds = await this.getThresholds()
       const activeLevels = thresholds.active()

       // ✅ Use centralized getPluginGroupMap() instead of manual query + filtering
       const groupByLabel = await this.getPluginGroupMap()
       const groups = await this.getGroups()

       let tabsMoved = 0

       // Check every tab and move if age doesn't match current group
       for (const tab of rawTabs) {
         if (tab.id == null) continue

         const row = new TabRow(tab, thresholds)
         const targetClassification = AgeClassification.fromDays(row.lastAccessDays ?? 0, thresholds)

         // Determine target label for this tab's age
         let targetLabel: string | null = null
         if (targetClassification.index > 0 && targetClassification.index <= activeLevels.length) {
           targetLabel = activeLevels[targetClassification.index - 1]?.label ?? null
         }

         // Get current group label
         let currentLabel: string | null = null
         if (tab.groupId != null && tab.groupId !== -1) {
           const currentGroup = groups.find((g: any) => g.id === tab.groupId)
           if (currentGroup) {
             const match = currentGroup.title.match(/^(.+?)\s*\(\d+\)$/)
             currentLabel = match ? match[1] : currentGroup.title
           }
         }

         // Move if target doesn't match current
         if (targetLabel !== currentLabel) {
           // Ungroup if currently grouped
           if (tab.groupId != null && tab.groupId !== -1) {
             try {
               await (browser.tabs as any).ungroup([tab.id])
             } catch (err) {
               console.warn(`[BackgroundTabService] ⚠️ Failed to ungroup tab#${tab.id}:`, err)
               continue
             }
           }

           // Move to target group (if has target)
           if (targetLabel && groupByLabel.has(targetLabel)) {
             try {
               const targetGroupId = groupByLabel.get(targetLabel)!
               await (browser.tabs as any).group({ tabIds: [tab.id], groupId: targetGroupId })
               tabsMoved++
             } catch (err) {
               console.warn(`[BackgroundTabService] ⚠️ Failed to group tab#${tab.id}:`, err)
             }
           } else if (targetLabel === null) {
             // Fresh tab stays ungrouped
             tabsMoved++
           }
         }
       }

       console.log(`[BackgroundTabService] ✅ updateTabByAge: ${tabsMoved} tabs moved`)
       return tabsMoved
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
      try {
        // 🎯 Filter: Only modify tabs IN plugin-created groups
        const inPluginGroup = await this.isInPluginGroup(tabId)
        if (!inPluginGroup) {
          return
        }

        // 📝 Get current tab + group info (guaranteed to exist after isInPluginGroup check)
        const tab = await browser.tabs.get(tabId)
        const groupId = tab.groupId as number

        let groupTitle: string | undefined
        try {
          groupTitle = (await (browser.tabGroups as any).get(groupId)).title
        } catch {
          // Group no longer exists (race condition), just return
          return
        }

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
            try {
              await (browser.tabGroups as any).update(groupId, {
                title: `${labelPrefix} (${groupTabs.length})`
              })
            } catch {
              // Group might have been auto-removed, ignore error
            }
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
     * Used by: groupTabsByAge(), updateTabByAge(), sortGroupsByDomain(), createMockTabs()
     */
     static async getTabs(): Promise<Browser.tabs.Tab[]> {
       const allTabs = await browser.tabs.query({ currentWindow: true })

       let filteredTabs: Browser.tabs.Tab[] = []

       if (browser.tabGroups != null) {
         // ✅ Use centralized getGroups() - only plugin groups, not user groups
         const groups = await this.getGroups()
         // ✅ Safety: filter out groups without id (shouldn't happen, but defensive)
         const pluginGroupIds = new Set<number>(groups.filter(g => g.id != null).map(g => g.id))

         // Keep ungrouped + plugin-grouped tabs
         filteredTabs = allTabs.filter(t => {
           if (t.groupId == null || t.groupId === -1) return true // Ungrouped
           return pluginGroupIds.has(t.groupId) // In plugin group
         })
       } else {
         // Firefox: no groups, return all tabs
         filteredTabs = allTabs
       }

      try {
        // Check if ANY mocks are set in storage
        const overrides = await mockOverrides.getValue()

        // If mocks exist, apply them to matching tab IDs
        if (overrides && Object.keys(overrides).length > 0) {
          await this.applyMockOverrides(filteredTabs)
        }
      } catch (err) {
        // Storage read error, continue with real tabs
        console.warn('[BackgroundTabService.getTabs] ⚠️ Failed to read mock overrides:', err)
      }

      return filteredTabs
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
      // ✅ Use fake time if warped, otherwise real time
      const now = await getCurrentTime()

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

      // Delay to ensure all tabs are created and loaded on slow runners
      await new Promise(r => setTimeout(r, 1500))

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

       // Extra delay to ensure storage is persisted/synchronized (WXT MV3 constraint - CI can be slow)
       await new Promise(r => setTimeout(r, 2500))

       // ✅ getTabs() automatically applies mock overrides to all tabs
       return await this.getTabs()
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
        // ✅ getTabs() automatically applies mock overrides
        const tabs = await this.getTabs()
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

    /**
     * Open a random tab from www.example.com/[0-9A-Z], optionally in a group.
     * @param newTabGroup - If true, creates a random group for the tab
     * @param index - Optional position index for the tab (default: rightmost)
     * @returns generated alphanumeric ID (4 random chars: 0-9 or A-Z)
     */
    static async openRandomTabInGroup(newTabGroup: boolean = false, index: number = 0): Promise<string> {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const generatedTabId = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]).join('')

      try {
        const url = `https://www.example.com/${generatedTabId}`
        const tab = await browser.tabs.create({ url, active: false })

        // ✅ Safety check: tab.id must exist before using it
        if (tab.id == null) {
          throw new Error('Failed to create tab - no tab ID returned')
        }

        await browser.tabs.move(tab.id, { index }).catch(() => {throw new Error('Failed to move tab')})
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
        // Fetch mock overrides if they exist
        let mockOverridesMap: Record<number, number> = {}
        try {
          const overrides = await mockOverrides.getValue()
          mockOverridesMap = overrides ?? {}
        } catch {
          // No overrides set, continue with empty map
        }

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

        // Apply mock overrides to tabs
        for (const tab of allTabs) {
          if (tab.id != null) {
            const numericOverride = mockOverridesMap[tab.id as number]
            const stringOverride = (mockOverridesMap as any)[String(tab.id)]
            const override = numericOverride ?? stringOverride
            if (override != null) {
              tab.lastAccessed = override
            }
          }
        }

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
  static async closeOldestGroupTabs(): Promise<number> {
    try {
      if (browser.tabGroups == null) {
        console.log('[BackgroundTabService] ℹ️ No tabGroups API available (Firefox), skipping auto-close')
        return 0
      }

      // Get all plugin-created groups, sorted by index
      const groups = await this.getGroups()
      if (groups.length === 0) {
        console.log('[BackgroundTabService] ℹ️ No plugin groups found, skipping auto-close')
        return 0
      }

      // Get the oldest group (first/leftmost = lowest index)
      const oldestGroup = groups[0]
      console.log(`[BackgroundTabService] 🗑️  Auto-closing oldest group: "${oldestGroup.title}" (ID: ${oldestGroup.id})`)

      // Query all tabs in this group
      const groupTabs = await browser.tabs.query({ groupId: oldestGroup.id })
      if (groupTabs.length === 0) {
        console.log(`[BackgroundTabService] ℹ️ Oldest group is empty, skipping close`)
        return 0
      }

      // Close all tabs in the group
      const tabIds = groupTabs.map(t => t.id).filter((id): id is number => id != null)
      await browser.tabs.remove(tabIds)
      console.log(`[BackgroundTabService] ✅ Auto-closed ${tabIds.length} tabs from oldest group`)

      // The group will be automatically removed when last tab is closed
      // But if any tabs remain (unlikely), try to remove the group itself
      try {
        await (browser.tabGroups as any).remove(oldestGroup.id)
      } catch {
        // Group might already be removed, that's ok
      }

      return tabIds.length
    } catch (err) {
      console.error('[BackgroundTabService] ❌ Failed to auto-close oldest group:', err)
      return 0
    }
  }

  /**
   * 🧪 DEV-ONLY: Manually trigger the 24h alarm to test groupTabsByAge() behavior.
   * Simulates: browser.alarms fires after 24 hours.
   *
   * Returns: count of groups created after grouping
   *
   * Used by: Dev UI button "Test 24h Alarm" in Options Page (dev mode only)
   */
  static async testTriggerAlarm24h(): Promise<number> {
    console.log('[BackgroundTabService] 🧪 DEV: Manually triggering 24h alarm...')
    try {
      const result = await this.groupTabsByAge()
      console.log(`[BackgroundTabService] 🧪 DEV: Alarm triggered → ${result} groups created`)
      return result
    } catch (err) {
      console.error('[BackgroundTabService] ❌ DEV: Failed to trigger alarm:', err)
      throw err
    }
  }

  /**
   * Get the oldest (first/leftmost) plugin-created group.
   * Returns null if no groups exist.
   */
  static getOldestGroup(): { id: number; title: string; index?: number } | null {
    try {
      if (browser.tabGroups == null) return null

      // This is a synchronous convenience method - it should be called after groups are loaded
      // In practice, components should call this after ensuring groups are available
      return null // Placeholder - actual implementation depends on reactive state
    } catch {
      return null
    }
  }

  /**
   * Format a group label with its age in days.
   * Example: "Week+ (5 days)"
   */
  static getGroupLabel(group: { id: number; title: string; index?: number }): string {
    return group.title
  }

  /**
   * Check if there are any ungrouped tabs.
   * Used to enable/disable burn mode button.
   */
  static hasStaleTabsToGroup(): boolean {
    // This should query current tabs and check if any are ungrouped
    return true // Placeholder
  }

  /**
   * Activate burn mode - set alarm to close oldest group in 24 hours
   */
  static async activateBurnMode(): Promise<void> {
    try {
      console.log('[BackgroundTabService] 🔥 Activating burn mode...')
      // Set alarm to fire in 24 hours
      await browser.alarms.create('burnModeAlarm', { delayInMinutes: 24 * 60 })
    } catch (err) {
      console.error('[BackgroundTabService] ❌ Failed to activate burn mode:', err)
      throw err
    }
  }

  /**
   * Deactivate burn mode - cancel the burn mode alarm
   */
  static async deactivateBurnMode(): Promise<void> {
    try {
      console.log('[BackgroundTabService] 🛑 Deactivating burn mode...')
      await browser.alarms.clear('burnModeAlarm')
    } catch (err) {
      console.error('[BackgroundTabService] ❌ Failed to deactivate burn mode:', err)
      throw err
    }
  }

}
