<template>
  <div class="row q-gutter-sm items-center">
    <!-- No Backup State -->
    <template v-if="!hasBackup">
      <q-btn
        class="got-btn-green"
        label="Backup Tabs"
        data-testid="backup-btn"
        icon="backup"
        rounded
        no-caps
        size="md"
        :loading="isLoading"
        @click="handleBackup"
      />
      <span class="text-caption text-grey">No backup saved</span>
    </template>

    <!-- Backup Exists State -->
    <template v-else>
      <q-btn
        class="got-btn-pink"
        label="Restore Tabs"
        data-testid="restore-btn"
        icon="history"
        rounded
        no-caps
        size="md"
        :loading="isLoading"
        @click="showRestoreDialog = true"
      />
      <div class="row items-center q-gutter-xs">
        <span class="text-caption text-grey" data-testid="backup-status">{{ statusMessage }}</span>
        <q-btn
          flat
          dense
          size="xs"
          label="Clear"
          icon="delete_outline"
          @click="handleClearBackup"
          data-testid="clear-backup-btn"
        />
      </div>
    </template>
  </div>

  <!-- Restore Confirmation Dialog -->
  <q-dialog
    v-model="showRestoreDialog"
    persistent
    data-testid="restore-dialog"
  >
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">⚠️ Restore Tabs</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          @click="showRestoreDialog = false"
        />
      </q-card-section>

      <q-card-section>
        <p>This will close all current tabs and restore {{ backupCount }} backed-up tabs.</p>
        <p>Your current state will be lost. Continue?</p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="Cancel"
          color="primary"
          @click="showRestoreDialog = false"
          data-testid="restore-cancel"
        />
        <q-btn
          unelevated
          label="Restore"
          color="primary"
          @click="confirmRestore"
          :loading="isLoading"
          data-testid="restore-confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { browser } from 'wxt/browser'

const hasBackup = ref(false)
const backupCount = ref(0)
const backupDate = ref('')
const isLoading = ref(false)
const statusMessage = ref('')
const showRestoreDialog = ref(false)

const BACKUP_KEY = 'archivum:tab_backup'

interface BackupTab {
  url?: string
  title?: string
  groupId?: number | null
}

interface BackupGroup {
  id: number
  title: string
  color?: string
}

interface Backup {
  tabs: BackupTab[]
  groups: BackupGroup[]
  createdAt: number
  count: number
}

// Check if backup exists on mount
onMounted(async () => {
  const data = await browser.storage.local.get(BACKUP_KEY)
  const backup = data[BACKUP_KEY] as Backup | undefined
  if (backup) {
    hasBackup.value = true
    backupCount.value = backup.count
    backupDate.value = new Date(backup.createdAt).toLocaleDateString()
    updateStatusMessage()
  }
})

function updateStatusMessage(): void {
  if (isLoading.value) {
    statusMessage.value = 'Restoring tabs...'
  } else if (hasBackup.value) {
    statusMessage.value = `${backupDate.value} | ${backupCount.value} tabs`
  } else {
    statusMessage.value = ''
  }
}

async function handleBackup(): Promise<void> {
  isLoading.value = true
  try {
    const tabs = await browser.tabs.query({ currentWindow: true })
    
    // Get groups if available (Chrome/Edge only)
    let groups: BackupGroup[] = []
    if (browser.tabGroups != null) {
      try {
        const rawGroups = await (browser.tabGroups as any).query({ windowId: (browser.windows as any).WINDOW_ID_CURRENT })
        groups = rawGroups.map((g: any) => ({ id: g.id, title: g.title, color: g.color }))
      } catch (err) {
        console.warn('[BackupRestore] Could not fetch groups:', err)
      }
    }

    const backup: Backup = {
      tabs: tabs.map(t => ({ 
        url: t.url, 
        title: t.title,
        groupId: t.groupId 
      })),
      groups,
      createdAt: Date.now(),
      count: tabs.length,
    }
    await browser.storage.local.set({ [BACKUP_KEY]: backup })
    hasBackup.value = true
    backupCount.value = backup.count
    backupDate.value = new Date(backup.createdAt).toLocaleDateString()
    statusMessage.value = `✅ Backed up ${backup.count} tabs${groups.length > 0 ? ` in ${groups.length} groups` : ''}`
    console.log('[BackupRestore] Backup successful:', backup.count, 'tabs,', groups.length, 'groups')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to backup tabs'
    statusMessage.value = `❌ Backup failed: ${errorMsg}`
    console.error('[BackupRestore] Backup error:', err)
  } finally {
    isLoading.value = false
    // Show success/error for 3 seconds then revert to normal status
    setTimeout(() => {
      if (hasBackup.value) {
        updateStatusMessage()
      }
    }, 3000)
  }
}

async function confirmRestore(): Promise<void> {
  showRestoreDialog.value = false
  console.log('[BackupRestore] User confirmed restore')
  isLoading.value = true
  statusMessage.value = 'Restoring tabs...'
  
  try {
    const allTabs = await browser.tabs.query({ currentWindow: true })
    console.log('[BackupRestore] Query all tabs:', allTabs.length)

    const extensionId = browser.runtime.getURL('')
    console.log('[BackupRestore] Extension ID:', extensionId)

    // Get current tab to avoid switching away
    const currentTab = allTabs.find(t => t.active)
    console.log('[BackupRestore] Current active tab:', currentTab?.id)

    const tabsToClose = allTabs
      .filter((t) => !t.url?.startsWith(extensionId))
      .map((t) => t.id!)

    console.log('[BackupRestore] Tabs to close:', tabsToClose.length)

    if (tabsToClose.length > 0) {
      await browser.tabs.remove(tabsToClose)
      console.log('[BackupRestore] Closed tabs, waiting 500ms')
      await new Promise(r => setTimeout(r, 500))
    }

    const data = await browser.storage.local.get(BACKUP_KEY)
    const backup = data[BACKUP_KEY] as Backup | undefined
    if (!backup) {
      throw new Error('No backup found in storage')
    }

    console.log('[BackupRestore] Backup found with', backup.count, 'tabs and', backup.groups?.length ?? 0, 'groups')

    // Recreate groups if available (Chrome/Edge only)
    const groupMap: Record<number, number> = {} // oldGroupId -> newGroupId
    if (browser.tabGroups != null && backup.groups && backup.groups.length > 0) {
      console.log('[BackupRestore] Recreating', backup.groups.length, 'groups...')
      for (const group of backup.groups) {
        try {
          const newGroup = await (browser.tabGroups as any).create([], {
            title: group.title,
            color: group.color,
            windowId: (browser.windows as any).WINDOW_ID_CURRENT
          })
          groupMap[group.id] = newGroup.id
          console.log(`[BackupRestore] Created group: ${group.title} (${group.id} -> ${newGroup.id})`)
        } catch (err) {
          console.warn(`[BackupRestore] Failed to create group ${group.title}:`, err)
        }
      }
    }

    // Restore tabs
    let restoredCount = 0
    const newTabIds: number[] = []
    
    for (const tabItem of backup.tabs) {
      if (tabItem.url && !tabItem.url.startsWith('chrome://') && !tabItem.url.startsWith('chrome-extension://')) {
        const newTab = await browser.tabs.create({ url: tabItem.url, active: false })
        if (newTab.id != null) {
          newTabIds.push(newTab.id)
          restoredCount++
        }
      }
    }

    console.log('[BackupRestore] Restored', restoredCount, 'tabs')

    // Assign tabs to groups if groups exist
    if (browser.tabGroups != null && Object.keys(groupMap).length > 0) {
      console.log('[BackupRestore] Assigning', newTabIds.length, 'tabs to groups...')
      for (let i = 0; i < backup.tabs.length && i < newTabIds.length; i++) {
        const oldTab = backup.tabs[i]
        const newTabId = newTabIds[i]
        if (oldTab.groupId != null && oldTab.groupId !== -1) {
          const newGroupId = groupMap[oldTab.groupId]
          if (newGroupId != null) {
            try {
              await (browser.tabs as any).group({ tabIds: [newTabId], groupId: newGroupId })
              console.log(`[BackupRestore] Assigned tab ${newTabId} to group ${newGroupId}`)
            } catch (err) {
              console.warn(`[BackupRestore] Could not assign tab to group:`, err)
            }
          }
        }
      }
    }
    
    // Reactivate the current tab if it still exists
    if (currentTab?.id) {
      try {
        await browser.tabs.update(currentTab.id, { active: true })
        console.log('[BackupRestore] Reactivated tab:', currentTab.id)
      } catch (err) {
        console.warn('[BackupRestore] Could not reactivate tab:', err)
      }
    }

    statusMessage.value = `✅ Restored ${restoredCount} tabs ${restoredCount < backup.count ? `(${backup.count - restoredCount} skipped)` : ''}`
    console.log('[BackupRestore] Success')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to restore tabs'
    statusMessage.value = `❌ Restore failed: ${errorMsg}`
    console.error('[BackupRestore] Error:', err)
  } finally {
    isLoading.value = false
    // Show success/error for 3 seconds then revert to normal status
    setTimeout(() => {
      if (hasBackup.value) {
        updateStatusMessage()
      }
    }, 3000)
  }
}

async function handleClearBackup(): Promise<void> {
  await browser.storage.local.remove(BACKUP_KEY)
  hasBackup.value = false
  backupCount.value = 0
  backupDate.value = ''
  statusMessage.value = 'Backup cleared'
  console.log('[BackupRestore] Backup cleared')
  
  // Show confirmation for 2 seconds
  setTimeout(() => {
    statusMessage.value = ''
  }, 2000)
}
</script>

<style scoped>
/* Minimal custom CSS - using Quasar grid classes for layout */
</style>
