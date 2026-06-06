import browser from 'webextension-polyfill'
import type { ThresholdLevel } from '@/constants'

type BrowserCapability = 'chrome-groups' | 'firefox-move' | 'none'

/**
 * Universal tab grouping service supporting Chrome/Edge (groups) and Firefox (reorder)
 */
export class TabGroupingService {
  static async detectCapability(): Promise<BrowserCapability> {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true, limit: 1 })
      if (!tabs.length) return 'none'

      // Chrome/Edge: has tabGroups API
      if (typeof (browser as any).tabGroups?.query === 'function') {
        return 'chrome-groups'
      }

      // Firefox: has tabs.move (to reorder)
      if (typeof browser.tabs.move === 'function') {
        return 'firefox-move'
      }

      return 'none'
    } catch {
      return 'none'
    }
  }

  /**
   * Group tabs by age (Chrome/Edge only)
   */
  static async groupTabsByAge(
    levelTabIds: number[][],
    levels: ThresholdLevel[]
  ): Promise<{ groupIds: (number | null)[]; error: string | null }> {
    try {
      const chromeApi = (globalThis as any).chrome
      if (!chromeApi?.tabs?.group || !chromeApi?.tabGroups?.update) {
        return { groupIds: [], error: 'Tab groups API not available' }
      }

      const groupIds: (number | null)[] = []

      // Reverse loop: Young → Middle → Old (for proper positioning)
      for (let i = levels.length - 1; i >= 0; i--) {
        const level = levels[i]
        const tabIds = levelTabIds[i] ?? []

        if (tabIds.length === 0) continue

        try {
          const groupId = await chromeApi.tabs.group({ tabIds })
          const queryResult = await browser.tabs.query({
            currentWindow: true,
            groupId,
          })
          const tabCount = queryResult.length

          await chromeApi.tabGroups.update(groupId, {
            title: `${level.label} (${level.days}d+) (${tabCount}t)`,
            color: level.color,
            collapsed: true,
          })

          groupIds.push(groupId)
        } catch (err) {
          groupIds.push(null)
        }
      }

      // Move groups to leftmost position (oldest first)
      if (chromeApi.tabGroups?.move) {
        for (const id of groupIds.reverse()) {
          if (id !== null) {
            try {
              await chromeApi.tabGroups.move(id, { index: 0 })
            } catch {
              // Silent fail on reposition
            }
          }
        }
      }

      return { groupIds, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { groupIds: [], error: message }
    }
  }

  /**
   * Reorder tabs by age (Firefox fallback)
   * Moves oldest tabs to leftmost position
   */
  static async reorderTabsByAge(
    levelTabIds: number[][],
    levels: ThresholdLevel[]
  ): Promise<string | null> {
    try {
      let targetIndex = 0

      // Loop oldest → youngest
      for (let i = 0; i < levelTabIds.length; i++) {
        const tabIds = levelTabIds[i] ?? []

        // Move each age group to leftmost
        for (const tabId of tabIds) {
          try {
            await browser.tabs.move(tabId, { index: targetIndex })
            targetIndex++
          } catch (err) {
            console.debug(`[TabGroupingService] Failed to move tab ${tabId}:`, err)
          }
        }
      }

      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return message
    }
  }
}
