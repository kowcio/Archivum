/**
 * BackupService — Auto-backup of tabs to browser.storage.
 *
 * Called hourly by the background service worker alarm.
 * Stores full tab list + group metadata to enable restore.
 */

import { browser } from 'wxt/browser'
import type { Browser } from 'wxt/browser'

const BACKUP_KEY = 'local:backup'

export interface BackupGroup {
  oldId: number
  title: string
  color?: string
}

export interface Backup {
  tabs: Browser.tabs.Tab[]
  groups: BackupGroup[]
  createdAt: number
  count: number
}

export class BackupService {
  /**
   * Auto-backup: Store current tabs + groups to browser.storage.local.
   * Called hourly by alarm listener in background.ts.
   * Overwrites previous backup (keeps latest only).
   */
  static async autoBackupTabs(): Promise<void> {
    try {
      const hasTabGroups = browser.tabGroups != null

      // Query all tabs
      const tabs = await browser.tabs.query({ currentWindow: true })

      // Query groups if available
      let groups: BackupGroup[] = []
      if (hasTabGroups) {
        const rawGroups = await (browser.tabGroups as any).query({
          windowId: (browser.windows as any).WINDOW_ID_CURRENT,
        })
        groups = rawGroups.map((g: any) => ({
          oldId: g.id,
          title: g.title,
          color: g.color,
        }))
      }

      const backup: Backup = {
        tabs,
        groups,
        createdAt: Date.now(),
        count: tabs.length,
      }

      await browser.storage.local.set({ [BACKUP_KEY]: backup })
      console.log(`[BackupService] ✅ Auto-backup: ${backup.count} tabs, ${groups.length} groups`)
    } catch (err) {
      console.error('[BackupService] ❌ Auto-backup failed:', err)
    }
  }
}
