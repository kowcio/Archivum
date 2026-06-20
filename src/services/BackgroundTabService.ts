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
import { getStorageThresholds, mockOverrides } from '@/store/appStore.ts'
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
   */
   private static async applyMockOverrides(tabs: { id?: number; lastAccessed?: number }[]): Promise<void> {
     const overrides = await mockOverrides.getValue()
     const ids = Object.keys(overrides).map(Number)
     console.log('[BackgroundTabService] Mock overrides storage:', { count: ids.length, tabIds: ids.slice(0, 3), sample: Object.entries(overrides).slice(0, 2) })
     if (!ids.length) {
       console.log('[BackgroundTabService] ⚠️ No mock overrides found!')
       return
     }

     for (const tab of tabs) {
       if (tab.id != null && overrides[tab.id] != null) {
         const oldAccess = tab.lastAccessed
         tab.lastAccessed = overrides[tab.id]
         console.log(`[BackgroundTabService] Tab#${tab.id}: ${oldAccess} → ${tab.lastAccessed} (${overrides[tab.id]})`)
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
       console.log(`[BackgroundTabService] Raw tabs: ${rawTabs.length}`)

       const thresholds = await this.getThresholds()
       console.log(`[BackgroundTabService] Thresholds: ${JSON.stringify(thresholds)}`)

       // Apply real activation timestamps + mock overrides
       await this.applyMockOverrides(rawTabs)

       const rows = TabRow.fromTabs(rawTabs, thresholds)
       console.log(`[BackgroundTabService] TabRows after fromTabs: ${rows.length}`)
       console.log(`[BackgroundTabService] Sample rows:`, rows.slice(0, 3).map(r => ({ id: r.id, lastAccessDays: r.lastAccessDays, title: r.title?.slice(0, 30) })))

       const activeLevels = thresholds.active()
       console.log(`[BackgroundTabService] Active levels: ${activeLevels.length} → ${activeLevels.map(l => l.label).join(', ')}`)

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
         console.log(`[BackgroundTabService] Tab#${row.id}: ${row.lastAccessDays}d → age index ${c.index}`)
         if (c.index === 0) {
           freshTabIds.push(row.id)
         } else if (c.index > 0 && c.index <= activeLevels.length) {
           levelTabIds[c.index - 1].push(row.id)
         }
       }

       console.log(`[BackgroundTabService] Distribution: fresh=${freshTabIds.length}, levels=[${levelTabIds.map(l => l.length).join(', ')}]`)

       // Sort tabs within each level by age (oldest first = highest lastAccessDays first)
       for (const ids of levelTabIds) {
         ids.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
       }

       const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
         if (!ids.length) {
           console.log(`[BackgroundTabService] Skipping empty group: ${title}`)
           return null
         }
         try {
           const id = await (browser.tabs as any).group({ tabIds: ids })
           console.log(`[BackgroundTabService] Grouped ${ids.length} tabs into group ${id}`)
           await (browser.tabGroups as any).update(id, { title, color, collapsed: true })
           console.log(`[BackgroundTabService] Updated group ${id}: title="${title}", color="${color}"`)
           return id
         } catch (err) {
           console.error(`[BackgroundTabService] Failed to create group "${title}":`, err)
           return null
         }
       }

       // Create groups from youngest → oldest so they appear left-to-right
       // Forward loop: create youngest groups first (they appear on the left)
       let groupsCreated = 0
       for (let i = 0; i < activeLevels.length; i++) {
         const level = activeLevels[i]
         console.log(`[BackgroundTabService] Creating group: index=${i}, level="${level.label}", tabCount=${levelTabIds[i].length}`)
         const gid = await createGroup(levelTabIds[i], `${level.label} (${levelTabIds[i].length})`, level.color)
         if (gid !== null) {
           groupsCreated++
           console.log(`[BackgroundTabService] ✅ Created group ${gid}: ${level.label}`)
         }
       }

       // Fresh (ungrouped) tabs stay in their original positions — don't move them
       console.log(`[BackgroundTabService] ✅ Created ${groupsCreated} age groups, ${freshTabIds.length} fresh tabs left in place`)
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

       // 🧩 ungroup BEFORE move — move alone keeps the tab inside its group (Chrome/Edge).
       // Without ungroup, the tab stays grouped and the whole group moves to the right.
       // Firefox lacks tabGroups API so ungroup throws — caught silently.
       try { await (browser.tabs as any).ungroup(tabId) } catch { /* Firefox / not grouped */ }

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
    * Returns tab objects — MockButton applies mockOverrides based on preset.
    *
    * NOTE: mockOverrides are set by MockButton (UI layer), not here.
    * This method only creates the tabs.
    */
   static async createMockTabs(): Promise<Browser.tabs.Tab[]> {
     const tabIds: number[] = []

     // Create tabs using realistic mock data
     for (let i = 0; i < MOCK_TABS.length; i++) {
       const mock = MOCK_TABS[i]
       try {
         const tab = await browser.tabs.create({
           url: mock.url,
           active: false,
         })
         if (tab.id != null) tabIds.push(tab.id)
       } catch {
         // Some URLs may fail — create simpler tabs as fallback
         const tab = await browser.tabs.create({ url: `https://example.com/mock-${i}`, active: false })
         if (tab.id != null) tabIds.push(tab.id)
       }
     }

     // Brief delay to let tabs start loading
     await new Promise(r => setTimeout(r, 500))

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
   * Groups tabs by domain name, with secondary sorting by age (if >2 tabs per domain).
   * Creates groups like "example.com (5)", "github.com (3)" etc.
   * Within each domain: if >2 tabs, sort by age (oldest first).
   *
   * CROSS-BROWSER SUPPORT:
   *   ✅ Chrome/Edge: Full grouping via browser.tabGroups API
   *   ✅ Firefox: No tabGroups API, gracefully skips grouping
   *   ✅ All browsers: Tabs sorted by domain, ungrouped tabs preserved
   */
  static async groupTabsByDomain(): Promise<number> {
    console.log('[BackgroundTabService] groupTabsByDomain...')
    try {
      const hasTabGroups = browser.tabGroups != null
      if (!hasTabGroups) {
        console.log('[BackgroundTabService] ℹ️ Tab grouping not available (Firefox)')
        return 0
      }

      const rawTabs = await browser.tabs.query({ currentWindow: true })
      console.log(`[BackgroundTabService] Raw tabs: ${rawTabs.length}`)

      // Apply mock overrides
      await this.applyMockOverrides(rawTabs)

      // Get thresholds for sorting tabs by age
      const thresholds = await this.getThresholds()

      // Create TabRow objects to access domain info
      const rows = TabRow.fromTabs(rawTabs, thresholds)
      console.log(`[BackgroundTabService] TabRows after fromTabs: ${rows.length}`)

      // Build age map for sorting
      const ageMap = new Map<number, number>()
      for (const row of rows) {
        if (row.id != null) ageMap.set(row.id, row.lastAccessDays ?? 0)
      }

      // Group tabs by domain
      const domainGroups = new Map<string, number[]>()
      for (const row of rows) {
        if (row.id == null) continue
        const domain = row.domain || 'unknown'
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, [])
        }
        domainGroups.get(domain)!.push(row.id)
      }

      console.log(`[BackgroundTabService] Found ${domainGroups.size} unique domains`)

      // Sort domains alphabetically and prepare for grouping
      const sortedDomains = Array.from(domainGroups.keys()).sort()
      const domainTabIds: Array<{ domain: string; tabIds: number[] }> = []

      for (const domain of sortedDomains) {
        const tabIds = domainGroups.get(domain)!
        // If more than 2 tabs in this domain, sort by age (oldest first = highest days first)
        if (tabIds.length > 2) {
          tabIds.sort((a, b) => (ageMap.get(b) ?? 0) - (ageMap.get(a) ?? 0))
          console.log(`[BackgroundTabService] Domain "${domain}" has ${tabIds.length} tabs (sorted by age)`)
        } else {
          console.log(`[BackgroundTabService] Domain "${domain}" has ${tabIds.length} tab(s) (no age sort needed)`)
        }
        domainTabIds.push({ domain, tabIds })
      }

      const createGroup = async (ids: number[], title: string, color: string): Promise<number | null> => {
        if (!ids.length) return null
        try {
          const id = await (browser.tabs as any).group({ tabIds: ids })
          await (browser.tabGroups as any).update(id, { title, color, collapsed: true })
          return id
        } catch {
          return null
        }
      }

      // Create groups from sorted domains (left to right = A to Z)
      let groupsCreated = 0
      const colorPalette = ['green', 'blue', 'orange', 'red', 'pink', 'purple', 'cyan', 'grey']
      for (let i = 0; i < domainTabIds.length; i++) {
        const { domain, tabIds } = domainTabIds[i]
        const color = colorPalette[i % colorPalette.length]
        const title = `${domain} (${tabIds.length})`
        const gid = await createGroup(tabIds, title, color)
        if (gid !== null) groupsCreated++
      }

      console.log(`[BackgroundTabService] ✅ Created ${groupsCreated} domain groups`)
      return groupsCreated
    } catch (err) {
      console.error('[BackgroundTabService] ❌', err)
      return 0
    }
  }
}
