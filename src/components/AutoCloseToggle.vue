<template>
  <div class="row items-center q-gutter-sm">
    <q-toggle
      :model-value="appStore.autoClose.value"
      label="🔥 Burn Mode"
      size="sm"
      data-testid="auto-close-toggle"
      @update:model-value="handleToggle"
    >

    <q-icon name="info" color="primary" size="xs" class="cursor-pointer q-ml-xs" />
      <q-tooltip class="text-caption">
        <div class="q-mb-sm">
          🔥 <strong>When enabled:</strong> Every 24 hours, all tabs in the oldest (leftmost) age group will be closed.
        </div>
        <div class="q-mb-sm">
          ⚠️ <strong>. You can find them in your browser history somewhere.</strong> If You remember what was there.
        </div>
        <div>
          💡 <strong>Tip:</strong> If you want to preserve a tab, simply click on it, it will move to the ungrouped part on the left.
        </div>
      </q-tooltip>
    </q-toggle>
    <q-icon
      v-if="showWarning"
      name="warning"
      color="negative"
      size="xs"
    >
      <q-tooltip>This feature is destructive and permanent</q-tooltip>
    </q-icon>

    <q-linear-progress
      v-if="appStore.loading.value"
      indeterminate
      color="primary"
      class="q-mt-xs"
      style="height: 2px; width: 100%"
    />

    <div v-if="appStore.error.value" class="text-negative text-caption q-mt-xs">
      {{ appStore.error.value }}
    </div>
  </div>

  <!-- Confirmation dialog for enabling -->
  <q-dialog
    v-model="showConfirmDialog"
    data-testid="auto-close-confirm-dialog"
  >
    <q-card style="min-width: 400px">
      <q-card-section class="row items-center">
        <q-icon name="warning" color="negative" size="lg" />
        <span class="q-ml-md text-h6">Enable Auto-Close?</span>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div class="text-body2 q-mb-md">
          This will automatically close all tabs in the oldest age group <strong>every 24 hours</strong>.
        </div>
        <div class="text-body2 q-mb-md">
          ⚠️ <strong>Closed tabs are permanently deleted</strong> and cannot be recovered.
        </div>
        <div class="text-body2">
          Are you sure you want to enable this feature?
        </div>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn
          flat
          label="Cancel"
          color="primary"
          v-close-popup
          @click="cancelEnable"
        />
        <q-btn
          flat
          label="Enable (I understand the risks)"
          color="negative"
          v-close-popup
          @click="confirmEnable"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const appStore = useAppStore()
const showConfirmDialog = ref(false)
const pendingValue = ref(false)

const showWarning = computed(() => appStore.autoClose.value)

async function handleToggle(newValue: boolean): Promise<void> {
  if (newValue && !appStore.autoClose.value) {
    // User is trying to ENABLE - show confirmation
    pendingValue.value = newValue
    showConfirmDialog.value = true
  } else if (!newValue && appStore.autoClose.value) {
    // User is DISABLING - no confirmation needed
    await appStore.setAutoClose(false)
  }
}

async function confirmEnable(): Promise<void> {
  await appStore.setAutoClose(true)
  pendingValue.value = false
}

function cancelEnable(): void {
  pendingValue.value = false
}
</script>

<style scoped>
/* Minimalist inline component - no extra styling needed */
</style>




