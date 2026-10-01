<template>
  <div class="row items-center q-gutter-sm" data-testid="auto-close-toggle">
    <button
      type="button"
      class="auto-close-switch"
      role="switch"
      :aria-checked="store.autoClose.value"
      :data-enabled="String(store.autoClose.value)"
      @click="handleToggle"
      @keydown.enter.prevent="handleToggle"
      @keydown.space.prevent="handleToggle"
    >
      <span class="auto-close-label">Auto close</span>
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
    </button>

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
  store.autoClose.value ? 'local_fire_department' : 'shield_off'
)

const iconColor = computed(() =>
  store.autoClose.value ? 'negative' : 'info'
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

async function handleToggle(): Promise<void> {
  const nextValue = !store.autoClose.value
  try {
    await store.storeSetAutoClose(nextValue)
  } catch (err) {
    console.error('[AutoCloseToggle.handleToggle]', err)
  }
}
</script>

<style scoped>
.auto-close-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font: inherit;
}

.auto-close-switch:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
  border-radius: 6px;
}

.auto-close-label {
  user-select: none;
}
</style>
