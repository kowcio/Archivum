import { browser } from 'wxt/browser'

export interface Backup {
  count: number
  tabs: Array<{ id?: number; title?: string; url: string }>
  groups: Array<{ oldId: number; title: string; color?: string }>
  createdAt: number
}

export class BackupService {
  static readonly BACKUP_KEY = 'archivum:tab_backup'

  static async backupTabs(): Promise<Backup> {
    const tabs = await browser.tabs.query({ currentWindow: true })
    let groups: any[] = []
    try {
      if (browser.tabGroups) {
        groups = await (browser.tabGroups as any).query({ windowId: (browser.windows as any).WINDOW_ID_CURRENT })
      }
    } catch {
      // Groups may not be available in all browsers
    }

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

    await browser.storage.local.set({ [this.BACKUP_KEY]: backup })
    return backup
  }

  static async restoreTabs(): Promise<void> {
    const data = await browser.storage.local.get(this.BACKUP_KEY)
    const backup = data[this.BACKUP_KEY] as Backup | undefined
    if (!backup) throw new Error('No backup found')

    const allTabs = await browser.tabs.query({ currentWindow: true })
    const extensionId = browser.runtime.getURL('')
    const tabsToClose = allTabs.filter((t) => !t.url?.startsWith(extensionId)).map((t) => t.id!)
    if (tabsToClose.length > 0) await browser.tabs.remove(tabsToClose)

    const restoredTabs: { tabId: number; originalGroupId?: number }[] = []
    for (const tab of backup.tabs) {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const newTab = await browser.tabs.create({ url: tab.url, active: false, pinned: false })
        restoredTabs.push({ tabId: newTab.id!, originalGroupId: tab.id })
      }
    }

    if (browser.tabGroups != null && backup.groups && backup.groups.length > 0) {
      for (const group of backup.groups) {
        const tabsForGroup = restoredTabs.filter(t => t.originalGroupId === group.oldId)
        if (tabsForGroup.length > 0) {
          const tabIds = tabsForGroup.map(t => t.tabId)
          const groupId = await (browser.tabs as any).group({ tabIds })
          await (browser.tabGroups as any).update(groupId, { title: group.title, color: group.color, collapsed: true })
        }
      }
    }
  }
}

