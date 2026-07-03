<template>
  <div class="row grid-backup-restore">
    <!-- A. Backup Button (Green, always visible) -->
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

    <!-- Status Message: No backup yet -->
    <span v-if="!hasBackup" class="text-caption text-grey">No backup yet</span>

    <!-- Status Message: Latest backup info + Delete Button -->
    <template v-else>
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
    </template>


    <!-- B. Restore Button (Pink, only when backup exists) -->
    <q-btn
      v-show="hasBackup"
      class="got-btn-pink justify-end"
      label="Restore Tabs"
      data-testid="restore-btn"
      icon="history"
      rounded
      no-caps
      size="md"
      :loading="isLoading"
      @click="showRestoreDialog = true"
    />


  </div>

  <!-- Restore Confirmation Dialog -->
  <q-dialog v-model="showRestoreDialog" persistent data-testid="restore-dialog">
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">⚠️ Restore Tabs</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="showRestoreDialog = false" />
      </q-card-section>

      <q-card-section>
        <p>This will close all current tabs and restore {{ backupCount }} backed-up tabs.</p>
        <p>Your current state will be lost. Continue?</p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="showRestoreDialog = false" data-testid="restore-cancel" />
        <q-btn unelevated label="Restore" color="primary" :loading="isLoading" @click="confirmRestore" data-testid="restore-confirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { browser } from 'wxt/browser'
import dayjs from 'dayjs'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

type Backup = { tabs: Browser.tabs.Tab[]; groups: any[]; createdAt: number; count: number }

// ✅ FIX: Define emit event so parent component knows restore completed
// Before: No emit → parent doesn't know restore finished → table never refreshes ❌
// Now: Emit 'restored' → parent calls refreshTabs() → table updates ✅
const emit = defineEmits<{ restored: [] }>()

const hasBackup = ref(false)
const backupCount = ref(0)
const backupDate = ref('')
const isLoading = ref(false)
const statusMessage = ref('')
const showRestoreDialog = ref(false)

const BACKUP_KEY = 'archivum:tab_backup'

onMounted(async () => {
  const data = await browser.storage.local.get(BACKUP_KEY)
  const backup = data[BACKUP_KEY] as Backup | undefined
  hasBackup.value = !!backup
  backupCount.value = backup?.count ?? 0
  backupDate.value = backup ? dayjs(backup.createdAt).format('YYYY-MM-DD HH:mm:ss') : ''
  statusMessage.value = backup ? `${backupDate.value} | ${backupCount.value} tabs` : ''
})

async function handleBackup(): Promise<void> {
  isLoading.value = true
  try {
    const response = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.BACKUP_TABS,
    }) as any
    if (response?.success) {
      hasBackup.value = true
      backupCount.value = response.count
      backupDate.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
      statusMessage.value = `${backupDate.value} | ${backupCount.value} tabs`
    } else {
      statusMessage.value = '❌ Backup failed'
    }
  } catch (err) {
    console.error('[BackupRestore]', err)
    statusMessage.value = '❌ Backup error'
  } finally {
    isLoading.value = false
  }
}

async function confirmRestore(): Promise<void> {
  showRestoreDialog.value = false
  isLoading.value = true
  try {
    const response = await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.RESTORE_TABS,
    }) as any
    if (!response?.success) {
      statusMessage.value = '❌ Restore failed'
    } else {
      // ✅ FIX: Emit 'restored' event after successful restore
      // Before: No event → App.vue doesn't know restore completed → table stays old ❌
      // Now: Parent catches @restored event → calls refreshTabs() → table refreshes ✅
      emit('restored')
    }
  } catch (err) {
    console.error('[BackupRestore]', err)
    statusMessage.value = '❌ Restore error'
  } finally {
    isLoading.value = false
  }
}

async function handleClearBackup(): Promise<void> {
  await browser.storage.local.remove(BACKUP_KEY)
  hasBackup.value = false
  backupCount.value = 0
  backupDate.value = ''
  statusMessage.value = ''
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
