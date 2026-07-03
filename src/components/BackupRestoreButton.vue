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
        @click="handleRestore"
      />
      <div class="row items-center q-gutter-xs">
        <span class="text-caption text-grey">{{ backupDate }} | {{ backupCount }} tabs</span>
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
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { browser } from 'wxt/browser'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const hasBackup = ref(false)
const backupCount = ref(0)
const backupDate = ref('')
const isLoading = ref(false)

const BACKUP_KEY = 'archivum:tab_backup'

interface Backup {
  tabs: Array<{ url?: string; title?: string }>
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
  }
})

async function handleBackup(): Promise<void> {
  isLoading.value = true
  const tabs = await browser.tabs.query({ currentWindow: true })
  const backup: Backup = {
    tabs: tabs.map(t => ({ url: t.url, title: t.title })),
    createdAt: Date.now(),
    count: tabs.length,
  }
  await browser.storage.local.set({ [BACKUP_KEY]: backup })
  hasBackup.value = true
  backupCount.value = backup.count
  backupDate.value = new Date(backup.createdAt).toLocaleDateString()
  $q.notify({
    type: 'positive',
    message: `✅ Backed up ${backup.count} tabs`,
    position: 'top',
    timeout: 3000,
  })
  isLoading.value = false
}

function handleRestore(): void {
  console.log('[BackupRestore] handleRestore() called')
  try {
    $q.dialog({
      title: '⚠️ Restore Tabs',
      message: `This will close all current tabs and restore ${backupCount.value} backed-up tabs. Your current state will be lost. Continue?`,
      cancel: true,
      persistent: true,
      ok: 'Restore',
    })
      .onOk(async () => {
        console.log('[BackupRestore] Dialog confirmed - starting restore')
        isLoading.value = true
        try {
          const allTabs = await browser.tabs.query({ currentWindow: true })
          console.log('[BackupRestore] Query all tabs:', allTabs.length)
          
          const extensionId = browser.runtime.getURL('')
          console.log('[BackupRestore] Extension ID:', extensionId)
          
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

          console.log('[BackupRestore] Backup found with', backup.count, 'tabs')

          let restoredCount = 0
          for (const tabItem of backup.tabs) {
            if (tabItem.url && !tabItem.url.startsWith('chrome://') && !tabItem.url.startsWith('chrome-extension://')) {
              await browser.tabs.create({ url: tabItem.url })
              restoredCount++
            }
          }
          
          console.log('[BackupRestore] Restored', restoredCount, 'tabs')
          
          $q.notify({
            type: 'positive',
            message: `✅ Restored ${restoredCount} tabs (${backup.count - restoredCount} skipped)`,
            position: 'top',
            timeout: 3000,
          })
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to restore tabs'
          console.error('[BackupRestore] Error:', err)
          $q.notify({
            type: 'negative',
            message: `❌ Error: ${errorMsg}`,
            position: 'top',
            timeout: 3000,
          })
        } finally {
          isLoading.value = false
        }
      })
      .onCancel(() => {
        console.log('[BackupRestore] Restore cancelled by user')
      })
  } catch (err) {
    console.error('[BackupRestore] Dialog creation error:', err)
    $q.notify({
      type: 'negative',
      message: `❌ Failed to show dialog: ${err instanceof Error ? err.message : 'Unknown error'}`,
      position: 'top',
      timeout: 3000,
    })
  }
}

async function handleClearBackup(): Promise<void> {
  await browser.storage.local.remove(BACKUP_KEY)
  hasBackup.value = false
  backupCount.value = 0
  backupDate.value = ''
  $q.notify({
    type: 'info',
    message: 'Backup cleared',
    position: 'top',
    timeout: 2000,
  })
}
</script>

<style scoped>
/* Minimal custom CSS - using Quasar grid classes for layout */
</style>
