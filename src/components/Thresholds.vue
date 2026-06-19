<template>
  <div class="row config-row" data-testid="thresholds-config">
    <div class="info-box col-2">
      <span class="label">Active Levels:</span>
      <span class="value">{{ localThresholds.activeLevels }} / {{ maxLevels }}</span>
    </div>
    <div class="col-2">
      <q-input
        data-testid="thresholds-levels-input"
        :model-value="localThresholds.activeLevels"
        label="Levels"
        type="number"
        :min="1"
        :max="maxLevels"
        :disable="appStore.loading.value"
        dense
        class="levels-input"
        @update:model-value="(v) => handleChangeCount(Number(v))"
      />
    </div>


    <!-- Action buttons -->
    <div class="col-auto action-buttons">
      <q-btn
        v-if="hasChanges && !appStore.loading.value"
        data-testid="threshold-apply"
        icon="check"
        label="Apply"
        color="positive"
        dense
        @click="handleApply"
      />
      <q-btn
        data-testid="threshold-reset"
        icon="refresh"
        label="Reset"
        color="secondary"
        dense
        flat
        :disable="appStore.loading.value"
        @click="handleReset"
      />
    </div>
  </div>

  <div v-if="appStore.error.value" class="error-text row">{{ appStore.error.value }}</div>

  <div class="thresholds-grid config-row q-mt-md row">
    <template v-for="(level, idx) in activeThresholds" :key="`threshold-${idx}`">
      <q-input
        :label-color="level.color"
        :data-testid="`threshold-${idx}`"
        :model-value="level.days"
        :label="level.label"
        type="number"
        :min="idx === 0 ? 0 : activeThresholds[idx - 1].days + 1"
        :max="idx === activeThresholds.length - 1 ? undefined : activeThresholds[idx + 1].days - 1"
        :disable="appStore.loading.value"
        dense
        @update:model-value="(v) => onChange(idx, Number(v))"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { browser } from 'wxt/browser'
import { useAppStore } from '@/store/appStore.ts'
import { AppThresholds } from '@/models/AppThresholds'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'

const appStore = useAppStore()
const emit = defineEmits<{ apply: [] }>()
const maxLevels = computed(() => appStore.thresholds.value.levels.length)

// Local state to track unsaved changes
// Initialize after store is loaded to avoid false change detection
const localThresholds = ref<AppThresholds>(AppThresholds.fromObject(appStore.thresholds.value.toJSON()))

const activeThresholds = computed(() => localThresholds.value.active())

// Check if there are unsaved changes (only when store is loaded)
const hasChanges = computed(() => {
  if (appStore.loading.value) return false

  // Check if activeLevels changed
  if (localThresholds.value.activeLevels !== appStore.thresholds.value.activeLevels) {
    return true
  }

  // Check if any threshold days changed
  for (let i = 0; i < localThresholds.value.levels.length; i++) {
    if (localThresholds.value.levels[i].days !== appStore.thresholds.value.levels[i].days) {
      return true
    }
  }

  return false
})

async function handleChangeCount(count: number): Promise<void> {
  if (!Number.isFinite(count) || count < 1) return
  localThresholds.value = localThresholds.value.withActiveLevels(count)
}

async function onChange(levelIdx: number, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return
  localThresholds.value = localThresholds.value.merge({ [levelIdx]: { days: value } })
}

// Apply changes and regroup tabs
async function handleApply(): Promise<void> {
  if (!hasChanges.value) {
    console.log('[Thresholds] No changes to apply')
    return
  }

  console.log('[Thresholds] handleApply: hasChanges=true, starting...')
  console.log('[Thresholds] Local:', { activeLevels: localThresholds.value.activeLevels, daysArray: localThresholds.value.levels.map(l => l.days) })
  console.log('[Thresholds] Store:', { activeLevels: appStore.thresholds.value.activeLevels, daysArray: appStore.thresholds.value.levels.map(l => l.days) })

  // Collect changes
  const changes: Record<number, Partial<{ days: number }>> = {}
  for (let i = 0; i < localThresholds.value.levels.length; i++) {
    if (localThresholds.value.levels[i].days !== appStore.thresholds.value.levels[i].days) {
      changes[i] = { days: localThresholds.value.levels[i].days }
    }
  }

  console.log('[Thresholds] Days changes:', changes)

  if (Object.keys(changes).length > 0) {
    console.log('[Thresholds] Saving threshold days changes...')
    await appStore.setThresholds(changes)
  }

  // Also update activeLevels if changed
  if (localThresholds.value.activeLevels !== appStore.thresholds.value.activeLevels) {
    console.log(`[Thresholds] Saving activeLevels change: ${appStore.thresholds.value.activeLevels} → ${localThresholds.value.activeLevels}`)
    await appStore.setActiveLevels(localThresholds.value.activeLevels)
  }

  // Reset local state to match store after save
  console.log('[Thresholds] Resetting local state after save...')
  localThresholds.value = AppThresholds.fromObject(appStore.thresholds.value.toJSON())

  // Regroup tabs with new thresholds
  console.log('[Thresholds] Applied → regrouping tabs by age...')
  try {
    await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE,
    })
    console.log('[Thresholds] ✅ Tabs regrouped successfully')
    emit('apply')
  } catch (err) {
    console.error('[Thresholds] ❌ Failed to regroup tabs:', err)
  }
}

async function handleReset(): Promise<void> {
  await appStore.resetToDefaults()
  localThresholds.value = AppThresholds.fromObject(appStore.thresholds.value.toJSON())
}

// Sync localThresholds when store changes (from another context)
onMounted(() => {
  watch(
    () => appStore.thresholds.value.toJSON(),
    () => {
      if (!appStore.loading.value && !hasChanges.value) {
        localThresholds.value = AppThresholds.fromObject(appStore.thresholds.value.toJSON())
      }
    }
  )
})
</script>

<style scoped>
.config-row {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 1rem;
  background: #fafafa;
  border-radius: 6px;
  border-left: 4px solid #1976d2;
}
.info-box {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 0.9rem;
  white-space: nowrap;
}
.label { font-weight: 600; color: #666; }
.value { font-weight: 700; color: #1976d2; }
.levels-input { min-width: 120px; }


.action-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.thresholds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: #fafafa;
  border-radius: 6px;
}
.error-text { font-size: 0.8rem; color: #d32f2f; width: 100%; margin-top: 0.5rem; }
</style>
