import { browser } from 'wxt/browser'

export interface Backup {
  count: number
  tabs: Array<{ id?: number; title?: string; url: string }>
  groups: Array<{ oldId: number; title: string; color?: string }>
  createdAt: number
}

export class BackupService {
  static async autoBackupTabs(): Promise<void> {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true })
      const groups = browser.tabGroups ? await browser.tabGroups.query({ windowId: (browser.windows as any).WINDOW_ID_CURRENT }) : []

      const backup: Backup = {
        count: tabs.length,
        tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url || '' })),
        groups: groups?.map((g: any) => ({
          oldId: g.id,
          title: g.title,
          color: g.color,
        })) || [],
        createdAt: Date.now(),
      }

      await browser.storage.local.set({ 'local:backup': backup })
    } catch (error) {
      console.error('[BackupService] ❌ Auto-backup failed:', error)
    }
  }
}
