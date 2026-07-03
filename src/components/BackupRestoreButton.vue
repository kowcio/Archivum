<template>
  <div class="grid-backup-restore">
    <!-- Backup Button / Content Grid -->
    <q-btn
      v-show="!hasBackup"
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

    <q-btn
      v-show="hasBackup"
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

    <!-- Status / Message -->
    <span v-show="!hasBackup" class="text-caption text-grey">No backup saved</span>
    <span v-show="hasBackup" class="text-caption text-grey" data-testid="backup-status">{{ statusMessage }}</span>

    <!-- Clear Button -->
    <q-btn
      v-show="hasBackup"
      flat
      dense
      size="xs"
      label="Clear"
      icon="delete_outline"
      @click="handleClearBackup"
      data-testid="clear-backup-btn"
    />
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
import type { Backup } from '@/services/BackgroundTabService'

const hasBackup = ref(false)
const backupCount = ref(0)
const backupDate = ref('')
const isLoading = ref(false)
const statusMessage = ref('')
const showRestoreDialog = ref(false)

const BACKUP_KEY = 'archivum:tab_backup'

// Check if backup exists on mount
onMounted(async () => {
  const data = await browser.storage.local.get(BACKUP_KEY)
  const backup = data[BACKUP_KEY] as Backup | undefined
  if (backup) {
    hasBackup.value = true
    backupCount.value = backup.count
    const backupDateTime = new Date(backup.createdAt)
    const date = backupDateTime.toLocaleDateString()
    const time = backupDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    backupDate.value = `${date} ${time}`
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
    const response = await browser.runtime.sendMessage({ action: 'backupTabsNow' })
    if (response.error) {
      throw new Error(response.error)
    }

    const backup = response.backup as Backup
    hasBackup.value = true
    backupCount.value = backup.count
    const backupDateTime = new Date(backup.createdAt)
    const date = backupDateTime.toLocaleDateString()
    const time = backupDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    backupDate.value = `${date} ${time}`
    statusMessage.value = `✅ Backed up ${backup.count} tabs`
    console.log('[BackupRestore] Backup successful:', backup.count, 'tabs,', backup.groups.length, 'groups')
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
    const response = await browser.runtime.sendMessage({ action: 'restoreTabsFromBackup' })
    if (response.error) {
      throw new Error(response.error)
    }

    statusMessage.value = `✅ Restored ${response.restoredCount} tabs`
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to restore tabs'
    statusMessage.value = `❌ Restore failed: ${errorMsg}`
    console.error('[BackupRestore] Error:', err)
  } finally {
    isLoading.value = false
    setTimeout(() => {
      updateStatusMessage()
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
.grid-backup-restore {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
}
</style>
