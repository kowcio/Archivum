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

</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/appStore'

const appStore = useAppStore()
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
  appStore.autoClose.value = newValue
}

</script>

<style scoped>
/* Minimalist inline component - no extra styling needed */
</style>




