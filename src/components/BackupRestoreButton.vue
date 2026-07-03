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

interface BackupGroup {
  oldId: number
  title: string
  color?: string
}

interface Backup {
  tabs: Browser.tabs.Tab[]
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
    
    // Store groups if available
    let groups: BackupGroup[] = []
    if (browser.tabGroups != null) {
      try {
        const rawGroups = await (browser.tabGroups as any).query({ windowId: (browser.windows as any).WINDOW_ID_CURRENT })
        groups = rawGroups.map((g: any) => ({ oldId: g.id, title: g.title, color: g.color }))
      } catch (err) {
        console.warn('[BackupRestore] Could not fetch groups:', err)
      }
    }

    const backup: Backup = {
      tabs,
      groups,
      createdAt: Date.now(),
      count: tabs.length,
    }
    await browser.storage.local.set({ [BACKUP_KEY]: backup })
    hasBackup.value = true
    backupCount.value = backup.count
    backupDate.value = new Date(backup.createdAt).toLocaleDateString()
    statusMessage.value = `✅ Backed up ${backup.count} tabs`
    console.log('[BackupRestore] Backup successful:', backup.count, 'tabs,', groups.length, 'groups')
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to backup tabs'
    statusMessage.value = `❌ Backup failed: ${errorMsg}`
    console.error('[BackupRestore] Backup error:', err)
  } finally {
    isLoading.value = false
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
    const extensionId = browser.runtime.getURL('')
    const currentTab = allTabs.find(t => t.active)

    const tabsToClose = allTabs
      .filter((t) => !t.url?.startsWith(extensionId))
      .map((t) => t.id!)

    console.log('[BackupRestore] Closing', tabsToClose.length, 'tabs')

    if (tabsToClose.length > 0) {
      await browser.tabs.remove(tabsToClose)
      await new Promise(r => setTimeout(r, 500))
    }

    const data = await browser.storage.local.get(BACKUP_KEY)
    const backup = data[BACKUP_KEY] as Backup | undefined
    if (!backup) {
      throw new Error('No backup found in storage')
    }

    console.log('[BackupRestore] Restoring', backup.count, 'tabs from backup with', backup.groups?.length ?? 0, 'groups')

    // Step 1: Restore all tabs (ungrouped)
    let restoredCount = 0
    const restoredTabs: { tabId: number; originalGroupId?: number }[] = []

    for (const tab of backup.tabs) {
      try {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          const newTab = await browser.tabs.create({ 
            url: tab.url,
            active: false,
            pinned: tab.pinned,
          })
          if (newTab.id != null) {
            restoredTabs.push({ tabId: newTab.id, originalGroupId: tab.groupId })
            restoredCount++
            console.log(`[BackupRestore] Created tab: ${tab.title || tab.url}`)
          }
        }
      } catch (err) {
        console.warn(`[BackupRestore] Could not restore tab: ${err}`)
      }
    }

    console.log('[BackupRestore] Restored', restoredCount, 'tabs')

    // Step 2: Group tabs by their original group ID
    if (browser.tabGroups != null && backup.groups && backup.groups.length > 0) {
      console.log('[BackupRestore] Grouping', restoredTabs.length, 'tabs into', backup.groups.length, 'groups')
      
      for (const group of backup.groups) {
        try {
          // Find all tabs that belonged to this group
          const tabsForGroup = restoredTabs.filter(t => t.originalGroupId === group.oldId)
          
          if (tabsForGroup.length > 0) {
            const tabIds = tabsForGroup.map(t => t.tabId)
            console.log(`[BackupRestore] Grouping ${tabIds.length} tabs into group "${group.title}"`)
            
            // Create group with these tabs
            const groupId = await (browser.tabs as any).group({ tabIds })
            
            // Update group properties
            await (browser.tabGroups as any).update(groupId, {
              title: group.title,
              color: group.color,
            })
            
            console.log(`[BackupRestore] Created group "${group.title}" with ${tabIds.length} tabs`)
          }
        } catch (err) {
          console.warn(`[BackupRestore] Failed to create group "${group.title}":`, err)
        }
      }
    }
    
    // Step 3: Reactivate current tab if it still exists
    if (currentTab?.id) {
      try {
        await browser.tabs.update(currentTab.id, { active: true })
      } catch (err) {
        console.warn('[BackupRestore] Could not reactivate tab:', err)
      }
    }

    statusMessage.value = `✅ Restored ${restoredCount} tabs`
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to restore tabs'
    statusMessage.value = `❌ Restore failed: ${errorMsg}`
    console.error('[BackupRestore] Error:', err)
  } finally {
    isLoading.value = false
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
