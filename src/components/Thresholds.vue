<template>
  <div class="thresholds-config" data-testid="thresholds-config">
    <!-- Row 1: Active Levels Control + Reset -->
    <div class="config-row">
      <div class="info-box">
        <span class="label">Active Levels:</span>
        <span class="value">{{ globalStore.thresholds.activeLevels }} / {{ constants.THRESHOLDS.presets.length }}</span>
      </div>

      <q-input
        data-testid="thresholds-levels-input"
        :model-value="globalStore.thresholds.activeLevels"
        label="Levels"
        type="number"
        :min="1"
        :max="constants.THRESHOLDS.presets.length"
        :disable="loading"
        dense
        class="levels-input"
        @update:model-value="(v) => handleChangeCount(Number(v))"
      />

      <q-btn
        data-testid="threshold-reset"
        icon="refresh"
        label="Reset"
        color="secondary"
        dense
        flat
        :disable="loading"
        @click="handleReset"
      />

      <div v-if="localError" class="error-text">
        {{ localError }}
      </div>
    </div>

    <!-- Row 2: Threshold Days Configuration -->
    <div class="thresholds-grid q-mt-md">
      <template v-for="(level, idx) in activeThresholds" :key="`threshold-${idx}`">
        <q-input
          :data-testid="`threshold-${idx}`"
          :model-value="level.days"
          :label="`${getLevelEmoji(idx)} ${level.label}`"
          type="number"
          :min="idx === 0 ? 0 : activeThresholds[idx - 1].days + 1"
          :max="idx === activeThresholds.length - 1 ? undefined : activeThresholds[idx + 1].days - 1"
          :disable="loading"
          :hint="getHint(idx, level.label)"
          dense
          @update:model-value="(v) => onChange(idx, Number(v))"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGlobalStore } from '@/stores/globalStore.ts'
import { useTabStore } from '@/stores/TabStore.ts'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds.ts'
import { APP_DEFAULTS } from '@/constants.ts'
import type { ThresholdLevel } from '@/constants.ts'

const globalStore = useGlobalStore()
const tabStore = useTabStore()
const loading = ref(false)
const localError = ref<string | null>(null)

const constants = computed(() => APP_DEFAULTS)
const activeThresholds = computed(() => globalStore.thresholds.active())

function getLevelEmoji(idx: number): string {
  const emojis = ['🟢', '🟡', '🟠', '🔴', '🔴', '🔴', '💀']
  return emojis[idx] ?? '⚫'
}

function getHint(idx: number, label: string): string {
  if (idx === 0) return `0 → ${label}`
  const prev = activeThresholds.value[idx - 1]
  return `${prev.label} (${prev.days}d) → ${label}`
}

async function handleChangeCount(count: number): Promise<void> {
  if (!Number.isFinite(count) || count < 1) return
  loading.value = true
  localError.value = null
  try {
    await globalStore.setActiveLevels(count)
    // Trigger tab re-marking with new threshold levels
    await tabStore.markOldTabs()
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

async function onChange(levelIdx: number, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return

  const currentLevel = activeThresholds.value[levelIdx]
  const patch: Record<string, Partial<ThresholdLevel>> = {
    [levelIdx]: {
      key: currentLevel.key,
      label: currentLevel.label,
      days: value,
      color: currentLevel.color,
    }
  }

  const updated = globalStore.thresholds.merge(patch)
  if (!updated.isValid()) {
    console.warn(`[Thresholds] Invalid level[${levelIdx}]=${value} rejected`)
    return
  }

  loading.value = true
  try {
    await globalStore.setThresholds(patch)
    // Trigger tab re-marking with updated threshold days
    await tabStore.markOldTabs()
  } finally {
    loading.value = false
  }
}

async function handleReset(): Promise<void> {
  loading.value = true
  localError.value = null
  try {
    // Reset both threshold levels and activeLevels count to defaults
    await globalStore.resetToDefaults()
    // Trigger tab re-marking with default thresholds
    await tabStore.markOldTabs()
    console.debug('[Thresholds] Reset to defaults and re-marked tabs')
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.thresholds-config {
  width: 100%;
}

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

.label {
  font-weight: 600;
  color: #666;
}

.value {
  font-weight: 700;
  color: #1976d2;
}

.levels-input {
  min-width: 120px;
}

.thresholds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: #fafafa;
  border-radius: 6px;
}

.error-text {
  font-size: 0.8rem;
  color: #d32f2f;
  width: 100%;
  margin-top: 0.5rem;
}
</style>

