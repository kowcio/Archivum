import { browser } from 'wxt/browser';
import { mockOverrides } from '@/store/appStore';
import { BackgroundTabService } from '@/services/BackgroundTabService.ts';

export interface Backup {
  count: number;
  // ✅ FIX: Added groupId to track which group each tab belonged to
  // Before: tabs without groupId → couldn't map tabs back to groups during restore
  // Now: Each tab knows its original groupId → can recreate group structure
  tabs: Array<{
    id?: number;
    title?: string;
    url: string;
    groupId?: number;
    lastAccessed?: number;
  }>;
  // ✅ NEW: Added index to preserve visual group positions
  // Before: Restored groups appeared in random order ❌
  // Now: Each group stores its original index → restored groups appear in exact same positions ✅
  groups: Array<{ oldId: number; title: string; color?: string; index?: number; collapsed?: boolean }>;
  createdAt: number;
}

export class BackupService {
  static readonly BACKUP_KEY = 'archivum:tab_backup';

  static async backupTabs(): Promise<Backup> {
    const tabs = await BackgroundTabService.getTabs();

    // ✅ NEW: Apply mock overrides BEFORE backup so we capture real ages
    // When testing with mocks: backup should have 7d, 14d, etc. not current timestamps
    const mockOvds = await mockOverrides.getValue();
    const mockOverridesMap: Record<number, number> = {};
    for (const key in mockOvds) {
      const numKey = parseInt(key, 10);
      mockOverridesMap[numKey] = mockOvds[key as any];
    }

    for (const tab of tabs) {
      if (tab.id != null && mockOverridesMap[tab.id] != null) {
        console.log(
          `[BackupService] Backup: Applying mock override to tab#${tab.id}: ${mockOverridesMap[tab.id]}`
        );
        tab.lastAccessed = mockOverridesMap[tab.id];
      }
    }

    let groups: any[] = [];
    try {
      if (browser.tabGroups) {
        groups = await (browser.tabGroups as any).query({
          windowId: (browser.windows as any).WINDOW_ID_CURRENT,
        });
      }
    } catch {
      // Groups may not be available in all browsers
    }

    const backup: Backup = {
      count: tabs.length,
      // ✅ FIX: Capture groupId + lastAccessed from each tab
      // groupId = reference to which group the tab belongs to (e.g., 5)
      // lastAccessed = timestamp when tab was last accessed
      // This enables: (1) recreating group structure, (2) restoring tab ages via mock overrides
      tabs: tabs.map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url || '',
        groupId: t.groupId,
        lastAccessed: t.lastAccessed,
      })),
      // ✅ NEW: Capture group index for position restoration
      // index = visual position of group in window (0 = leftmost, 1 = next, etc.)
      // This preserves exact group positions when user has rearranged them
      // Groups stored by visual order (sorted by index) for consistent restoration
       groups:
         groups
           ?.sort((a: any, b: any) => (a.index ?? -1) - (b.index ?? -1))
           ?.map((g: any) => ({
             oldId: g.id,
             title: g.title,
             color: g.color,
             index: g.index,
             collapsed: g.collapsed,
           })) || [],
      createdAt: Date.now(),
    };

    console.log(
      '[BackupService] Backup data - tabs with lastAccessed:',
      backup.tabs.map((t) => ({ id: t.id, lastAccessed: t.lastAccessed }))
    );
    await browser.storage.local.set({ [this.BACKUP_KEY]: backup });
    return backup;
  }

  static async restoreTabs(): Promise<void> {
    const data = await browser.storage.local.get(this.BACKUP_KEY);
    const backup = data[this.BACKUP_KEY] as Backup | undefined;
    if (!backup) throw new Error('No backup found');

    console.log('[BackupService] Restoring tabs from backup:', {
      tabCount: backup.tabs.length,
      groupCount: backup.groups.length,
    });

    const allTabs = await browser.tabs.query({ currentWindow: true });
    const extensionId = (browser.runtime as any).getURL('');
    const tabsToClose = allTabs.filter((t) => !t.url?.startsWith(extensionId)).map((t) => t.id!);
    if (tabsToClose.length > 0) await browser.tabs.remove(tabsToClose);

    const restoredTabs: { tabId: number; originalGroupId?: number }[] = [];
    const restoredOverrides: Record<number, number> = {};

    for (const tab of backup.tabs) {
      if (
        tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://')
      ) {
        try {
          const newTab = await browser.tabs.create({ url: tab.url, active: false, pinned: false });
          // ✅ CRITICAL FIX: Use tab.groupId (NOT tab.id!)
          // tab.id = tab's unique ID (e.g., 10)
          // tab.groupId = which group it belonged to (e.g., 5)
          // WRONG: originalGroupId: tab.id  → matches group.oldId never → tabs stay ungrouped ❌
          // CORRECT: originalGroupId: tab.groupId → matches group.oldId correctly → groups recreated ✅
          restoredTabs.push({ tabId: newTab.id!, originalGroupId: tab.groupId });

          // ✅ NEW: Store lastAccessed override for mock overrides
          // This preserves tab ages when restored (e.g., "7 days old" stays "7 days old")
          if (newTab.id != null && tab.lastAccessed != null) {
            console.log(
              `[BackupService] Override: newTab#${newTab.id} ← oldTab.lastAccessed=${tab.lastAccessed}`
            );
            restoredOverrides[newTab.id] = tab.lastAccessed;
          }
        } catch (err) {
          console.error(`[BackupService] Failed to create tab with URL "${tab.url}":`, err);
          // Continue to next tab instead of failing entire restore
        }
      }
    }

    // ✅ NEW: Restore mock overrides so table shows correct tab ages
    // Before: Restored tabs show "0 days" (fresh) because lastAccessed = now ❌
    // After: Mock overrides applied → table shows original ages (7d, 14d, etc.) ✅
    if (Object.keys(restoredOverrides).length > 0) {
      try {
        console.log(
          `[BackupService] About to set ${Object.keys(restoredOverrides).length} overrides:`,
          restoredOverrides
        );
        await mockOverrides.setValue(restoredOverrides);
        console.log(
          `[BackupService] ✅ Restored ${Object.keys(restoredOverrides).length} tab age overrides`
        );
      } catch (err) {
        console.warn('[BackupService] ⚠️ Failed to restore mock overrides:', err);
      }
    }

    console.log('[BackupService] Restored tabs (ungrouped):', restoredTabs.length);
    console.log(
      '[BackupService] Groups to restore:',
      backup.groups.map((g) => ({ id: g.oldId, title: g.title }))
    );

    if (browser.tabGroups != null && backup.groups && backup.groups.length > 0) {
      console.log('[BackupService] tabGroups API available, recreating groups...');
      for (const group of backup.groups) {
        // ✅ FIX: Filter tabs using groupId matching
        // Find all restored tabs where originalGroupId === group.oldId
        // This pairs up: restored tabs (with groupId=5) → old group (oldId=5) ✅
        // Also filter out ungrouped tabs (groupId=-1 or undefined)
        const tabsForGroup = restoredTabs.filter(
          (t) =>
            t.originalGroupId === group.oldId &&
            t.originalGroupId != null &&
            t.originalGroupId !== -1
        );
        console.log(
          `[BackupService] Group "${group.title}" (oldId=${group.oldId}): ${tabsForGroup.length} tabs found`
        );
        if (tabsForGroup.length > 0) {
          try {
            const tabIds = tabsForGroup.map((t) => t.tabId);
            // Recreate group with NEW ID (group IDs are ephemeral)
            const groupId = await (browser.tabs as any).group({ tabIds });
            // ✅ NEW: Restore with original index for exact position preservation
            // Before: Restored groups appeared in random order ❌
            // Now: Each group restored at its original index position ✅
            // group.index is set during backup, preserved here for consistency
             await (browser.tabGroups as any).update(groupId, {
               title: group.title,
               color: group.color,
               collapsed: group.collapsed ?? true,
               index: group.index ?? -1,
             });
            console.log(
              `[BackupService] ✅ Created group "${group.title}" with newId=${groupId}, index=${group.index}`
            );
          } catch (err) {
            console.error(`[BackupService] Failed to create/update group "${group.title}":`, err);
            // Continue to next group instead of failing entire restore
          }
        }
      }
    } else {
      console.log('[BackupService] tabGroups API not available, skipping group restoration');
    }
  }
}
