<template>
  <div class="backup-sections">
    <!-- Section 1: Backup Button -->
    <q-btn
      class="got-btn-green"
      label="Backup Tabs"
      data-testid="backup-btn"
      icon="cloud_upload"
      rounded
      no-caps
      size="md"
      :loading="isLoading"
      @click="handleBackup"
    />

    <!-- Section 2: Delete/Clear Backup Button (with date) -->
    <div v-if="hasBackup" class="backup-delete-control col-12">
      <q-btn
        class="got-btn-ghost q-px-md backup-delete-main"
        :label="statusMessage"
        dense
        no-caps
        :loading="isLoading"
      >
        <q-btn
          data-testid="clear-backup-btn"
          class="got-btn-ghost q-ml-sm "
          icon="delete"
          dense
          flat
          color="negative"
          :loading="isLoading"
          @click.stop.prevent="handleClearBackup"
        >
          <q-tooltip class="bg-dark text-white">
            Remove the archived tabs
          </q-tooltip>
        </q-btn>
      </q-btn>
    </div>

    <!-- Fallback text when no backup -->
    <span v-else class="text-caption text-grey">Nothing archived yet</span>

    <!-- Section 3: Restore Button -->
    <q-btn
      v-show="hasBackup"
      class="got-btn-pink"
      label="Restore Tabs"
      data-testid="restore-btn"
      icon="cloud_download"
      rounded
      no-caps
      size="md"
      :loading="isLoading"
      @click="showRestoreDialog = true"
    />


    <div data-testid="backup-restore-timer" class="">

    </div>


  </div>


  <!-- Restore Confirmation Dialog -->
  <q-dialog v-model="showRestoreDialog" persistent data-testid="restore-dialog">
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">⚠️ Restore Tabs</div>
        <q-space/>
        <q-btn icon="close" flat round dense @click="showRestoreDialog = false"/>
      </q-card-section>

      <q-card-section>
        <p>This will close all current tabs and restore {{ backupCount }} backed-up tabs.</p>
        <p>Your current state will be lost. Continue?</p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" @click="showRestoreDialog = false"
               data-testid="restore-cancel"/>
        <q-btn unelevated label="Restore" color="primary" :loading="isLoading"
               @click="confirmRestore" data-testid="restore-confirm"/>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {browser} from 'wxt/browser'
import type {Browser} from 'wxt/browser'
import dayjs from 'dayjs'
import {BACKGROUND_MESSAGE_ACTIONS} from '@/constants'

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
      // ✅ FIX: Multiple waits to ensure storage persistence
      // Before: emit immediately → table refreshes before overrides saved → shows 0 days ❌
      // After: wait 1000ms for storage sync + background processing ✅
      await new Promise(r => setTimeout(r, 1000))  // ← LONGER WAIT

      // ✅ FIX: Emit 'restored' event after successful restore + storage sync
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
.backup-sections {
  display: contents; /* Let parent handle layout */
}

.backup-delete-control {
  display: inline-flex;
  align-items: center;
}

.backup-delete-main {
  cursor: default !important;
}

.backup-delete-icon {
  cursor: pointer !important;
}

.backup-delete-control :deep(.q-btn) {
  color: #d32f2f;
}

.backup-delete-control :deep(.q-btn .q-icon) {
  color: #d32f2f;
}

.got-btn-ghost {
  color: #d32f2f;
}

.got-btn-ghost .q-icon {
  color: #d32f2f;
}

.got-btn-ghost q-tooltip {
  color: #d32f2f;
}
</style>
