<template>
  <div class="row col-12 " data-testd="thresholds-view">
    <div
      class="col-12 row items-center q-pa-md bg-grey-1 rounded-borders"
      data-testid="thresholds-config"
      style="gap: 12px"
    >
      <div class="info-box col-2">
        <div class="label">Active Levels:</div>
        <div class="value">{{ localThresholds.activeLevels }} / {{ maxLevels }}</div>
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
      <div class="col-auto" data-testid="threshold-button">
        <q-btn
          v-if="hasChanges && !appStore.loading.value"
          data-testid="threshold-apply"
          class="q-px-sm"
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
      <div v-if="appStore.error.value" class="error-text row">{{ appStore.error.value }}</div>
    </div>

    <div
      class="col-12 row items-center q-px-md q-pb-md bg-grey-1 rounded-borders thresholds-levels-grid"
      data-testid="threshold-levels"
    >
      <div class="col-1 col-auto q-pa-xs">
        <q-input
          label="Start"
          data-testid="threshold-start"
          :model-value="0"
          type="number"
          disable
          dense
        />
      </div>
      <template v-for="(level, idx) in activeThresholds" :key="`threshold-${idx}`">
        <div class="col-2  q-pa-xs">
          <q-input
            :label-color="level.color"
            :data-testid="`threshold-${idx}`"
            :model-value="level.days"
            :label="level.label"
            type="number"
            :min="idx === 0 ? 0 : activeThresholds[idx - 1].days + 1"
            :max="idx === activeThresholds.length - 1 ? undefined : activeThresholds[idx + 1].days - 1"
            :disable="isThresholdEditingDisabled"
            dense
            @update:model-value="(v) => onChange(idx, Number(v))"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref, onMounted, watch} from 'vue'
import {browser} from 'wxt/browser'
import {useAppStore} from '@/store/appStore.ts'
import {AppThresholds} from '@/models/AppThresholds'
import {BACKGROUND_MESSAGE_ACTIONS, APP_DEFAULTS, isDevEnv} from '@/constants'

const appStore = useAppStore()
const emit = defineEmits<{ apply: [] }>()
const maxLevels = computed(() => APP_DEFAULTS.THRESHOLDS.presets.length)
const isThresholdEditingDisabled = computed<boolean>(() => appStore.loading.value || isDevEnv)

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
  if (count > maxLevels.value || count < 1) return
  localThresholds.value = localThresholds.value.withActiveLevels(count)
}

async function onChange(levelIdx: number, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return
  localThresholds.value = localThresholds.value.merge({[levelIdx]: {days: value}})
}

// Apply changes and regroup tabs
async function handleApply(): Promise<void> {
  if (!hasChanges.value) return

  try {
// Collect threshold changes
    const changes: Record<number, Partial<{ days: number }>> = {}
    for (let i = 0; i < localThresholds.value.levels.length; i++) {
      if (localThresholds.value.levels[i].days !== appStore.thresholds.value.levels[i].days) {
        changes[i] = {days: localThresholds.value.levels[i].days}
      }
    }

    if (Object.keys(changes).length > 0) {
      await appStore.setThresholds(changes)
    }

    if (localThresholds.value.activeLevels !== appStore.thresholds.value.activeLevels) {
      await appStore.setActiveLevels(localThresholds.value.activeLevels)
    }

    localThresholds.value = AppThresholds.fromObject(appStore.thresholds.value.toJSON())

    await browser.runtime.sendMessage({
      action: BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE,
    })
    emit('apply')
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (errorMsg.includes('DataCloneError') || errorMsg.includes('Proxy')) {
      appStore.error.value = `[THRESHOLD_APPLY_PROXY_ERROR] Cannot serialize threshold data. Try refreshing the page.`
    } else {
      appStore.error.value = `[THRESHOLD_APPLY_ERROR] ${errorMsg}`
    }
    console.error('[Thresholds.handleApply]', appStore.error.value)
  }
}

async function handleReset(): Promise<void> {
  await appStore.resetToDefaults()
  localThresholds.value = AppThresholds.fromObject(appStore.thresholds.value.toJSON())

// Regroup with defaults and refresh table
  await browser.runtime.sendMessage({
    action: BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE,
  })
  emit('apply')
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

.label {
  font-weight: 600;
  color: #666;
}

.value {
  font-weight: 700;
  color: #1976d2;
}

.error-text {
  font-size: 0.8rem;
  color: #d32f2f;
  width: 100%;
}
</style>
