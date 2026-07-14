<template>
  <div class="row items-center q-gutter-sm" data-testid="auto-close-toggle">
    <q-toggle
      :model-value="appStore.autoClose.value"
      label="Auto close"
      size="sm"
      @update:model-value="handleToggle"
    >
      <q-icon
        :name="iconName"
        :color="iconColor"
        size="xs"
        class="cursor-pointer q-ml-xs"
      />
      <q-tooltip
        class="text-caption"
        data-testid="auto-close-tooltip"
      >
        <div class="q-mb-sm">
          {{ tooltipLine1 }}
        </div>
        <div>
          {{ tooltipLine2 }}
        </div>
      </q-tooltip>
    </q-toggle>

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

// Computed properties for dynamic icon and tooltip
const iconName = computed(() =>
  appStore.autoClose.value ? 'local_fire_department' : 'shield_off'
)

const iconColor = computed(() =>
  appStore.autoClose.value ? 'negative' : 'info'
)

const tooltipLine1 = computed(() => {
  if (appStore.autoClose.value) {
    return '🔥 Active: Oldest group tabs will auto-delete every 24 hours.'
  }
  return '🛡️ Inactive: Your tabs are safe. Enable to auto-delete oldest group after 24h.'
})

const tooltipLine2 = computed(() => {
  if (appStore.autoClose.value) {
    return '⚠️ Permanent deletion — tabs cannot be recovered.'
  }
  return '💡 Tip: Click a tab to move it to ungrouped section and preserve it.'
})

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




