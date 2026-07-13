<template>
  <div class="col-12 row items-start q-pa-md bg-grey-1 rounded-borders accent-border" style="gap: 1rem; flex-direction: column">
    <!-- Header with toggle -->
    <div class="row items-center" style="gap: 1rem; width: 100%">
      <q-toggle
        :model-value="appStore.autoClose.value"
        label="Auto-close tabs in the oldest group after 1 day"
        data-testid="auto-close-toggle"
        @update:model-value="handleToggle"
      />
      <q-icon
        v-if="showWarning"
        name="warning"
        color="negative"
        size="sm"
        class="q-ml-md"
      >
        <q-tooltip>This feature is destructive and permanent</q-tooltip>
      </q-icon>
    </div>

    <!-- Explanation -->
    <div v-if="appStore.autoClose.value" class="col-12 text-caption text-grey-7">
      <div class="q-mb-md">
        🗑️ <strong>When enabled:</strong> Every 24 hours, all tabs in the oldest (leftmost) age group will be automatically closed permanently.
        This is useful for keeping your browser clean without manual intervention.
      </div>
      <div class="q-mb-md">
        ⚠️ <strong>Important:</strong> Closed tabs cannot be recovered. Make sure you've reviewed any important tabs before they reach the oldest group.
      </div>
      <div>
        💡 <strong>Tip:</strong> If you want to preserve a tab, simply activate it (click on it) to move it to the newest group.
      </div>
    </div>

    <!-- Loading state -->
    <q-linear-progress
      v-if="appStore.loading.value"
      indeterminate
      color="primary"
      class="col-12"
    />

    <!-- Error display -->
    <div v-if="appStore.error.value" class="col-12 text-negative text-caption">
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
.q-icon {
  font-size: 1.2rem;
}
</style>




