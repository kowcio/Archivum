import { browser } from 'wxt/browser'

export interface Backup {
  count: number
  // ✅ FIX: Added groupId to track which group each tab belonged to
  // Before: tabs without groupId → couldn't map tabs back to groups during restore
  // Now: Each tab knows its original groupId → can recreate group structure
  tabs: Array<{ id?: number; title?: string; url: string; groupId?: number }>
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
      // ✅ FIX: Capture groupId from each tab
      // groupId = reference to which group the tab belongs to (e.g., 5)
      // This is the KEY to restoring the group structure later!
      tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url || '', groupId: t.groupId })),
      // Also get group metadata (title, color) separately via tabGroups API
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

     console.log('[BackupService] Restoring tabs from backup:', { tabCount: backup.tabs.length, groupCount: backup.groups.length })

     const allTabs = await browser.tabs.query({ currentWindow: true })
     const extensionId = browser.runtime.getURL('')
     const tabsToClose = allTabs.filter((t) => !t.url?.startsWith(extensionId)).map((t) => t.id!)
     if (tabsToClose.length > 0) await browser.tabs.remove(tabsToClose)

      const restoredTabs: { tabId: number; originalGroupId?: number }[] = []
      for (const tab of backup.tabs) {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          const newTab = await browser.tabs.create({ url: tab.url, active: false, pinned: false })
          // ✅ CRITICAL FIX: Use tab.groupId (NOT tab.id!)
          // tab.id = tab's unique ID (e.g., 10)
          // tab.groupId = which group it belonged to (e.g., 5)
          // WRONG: originalGroupId: tab.id  → matches group.oldId never → tabs stay ungrouped ❌
          // CORRECT: originalGroupId: tab.groupId → matches group.oldId correctly → groups recreated ✅
          restoredTabs.push({ tabId: newTab.id!, originalGroupId: tab.groupId })
        }
      }

     console.log('[BackupService] Restored tabs (ungrouped):', restoredTabs.length)
     console.log('[BackupService] Groups to restore:', backup.groups.map(g => ({ id: g.oldId, title: g.title })))

      if (browser.tabGroups != null && backup.groups && backup.groups.length > 0) {
        console.log('[BackupService] tabGroups API available, recreating groups...')
        for (const group of backup.groups) {
          // ✅ FIX: Filter tabs using groupId matching
          // Find all restored tabs where originalGroupId === group.oldId
          // This pairs up: restored tabs (with groupId=5) → old group (oldId=5) ✅
          // Also filter out ungrouped tabs (groupId=-1 or undefined)
          const tabsForGroup = restoredTabs.filter(t => t.originalGroupId === group.oldId && t.originalGroupId != null && t.originalGroupId !== -1)
          console.log(`[BackupService] Group "${group.title}" (oldId=${group.oldId}): ${tabsForGroup.length} tabs found`)
          if (tabsForGroup.length > 0) {
            const tabIds = tabsForGroup.map(t => t.tabId)
            // Recreate group with NEW ID (group IDs are ephemeral)
            const groupId = await (browser.tabs as any).group({ tabIds })
            // Apply original metadata to new group
            await (browser.tabGroups as any).update(groupId, { title: group.title, color: group.color, collapsed: true })
            console.log(`[BackupService] ✅ Created group "${group.title}" with newId=${groupId}`)
          }
        }
      } else {
        console.log('[BackupService] tabGroups API not available, skipping group restoration')
      }
   }
}

