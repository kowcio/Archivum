<template>
  <div class="row items-center q-gutter-sm">
    <div class="row items-center q-gutter-xs auto-close-toggle-wrap">
      <q-toggle
        :model-value="store.autoClose.value"
        label="Auto close"
        color="negative"
        left-label
        :disable="store.loading.value"
        data-testid="auto-close-toggle"
        @update:model-value="handleToggle"
      >
        <q-tooltip class="text-caption" data-testid="auto-close-tooltip">
          <div class="q-mb-sm">
            {{ tooltipLine1 }}
          </div>
          <div>
            {{ tooltipLine2 }}
          </div>
        </q-tooltip>
      </q-toggle>

      <q-icon
        :name="iconName"
        :color="iconColor"
        size="sm"
        class="auto-close-status-icon"
      />
    </div>

    <q-linear-progress
      v-if="store.loading.value"
      indeterminate
      color="primary"
      class="q-mt-xs"
      style="height: 2px; width: 100%"
    />

    <div v-if="store.error.value" class="text-negative text-caption q-mt-xs">
      {{ store.error.value }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '@/composables/useStore'

const store = useStore()

const iconName = computed(() =>
  store.autoClose.value ? 'local_fire_department' : 'shield'
)

const iconColor = computed(() =>
  store.autoClose.value ? 'negative' : 'positive'
)

const oldestGroupName = computed(() => {
  const activeThresholds = store.thresholds.value.activeThresholdLevels()
  if (activeThresholds.length === 0) return 'oldest group'
  return activeThresholds[activeThresholds.length - 1].label
})

const tooltipLine1 = computed(() => {
  if (store.autoClose.value) {
    return `🔥 Active: "${oldestGroupName.value}" tabs will auto-close every 24 hours.`
  }
  return `🛡️ Inactive: Your tabs are safe. Enable to auto-close "${oldestGroupName.value}" after 24h.`
})

const tooltipLine2 = computed(() => {
  if (store.autoClose.value) {
    return '⚠️ Auto closure — search Your browser history.'
  }
  return '💡 Tip: Click a tab to move it to ungrouped section and preserve it.'
})

async function handleToggle(nextValue: boolean): Promise<void> {
  if (nextValue === store.autoClose.value) return

  try {
    await store.storeSetAutoClose(nextValue)
  } catch (err) {
    console.error('[AutoCloseToggle.handleToggle]', err)
  }
}
</script>

<style scoped>
.auto-close-toggle-wrap {
  min-height: 32px;
}

.auto-close-status-icon {
  opacity: 0.9;
}

:deep(.q-toggle__label) {
  user-select: none;
}
</style>
