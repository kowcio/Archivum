<template>
  <div class="row config-row" data-testid="thresholds-config">
    <!-- Row 1: Active Levels Control + Reset -->
    <div class="info-box col-2">
      <span class="label">Active Levels:</span>
      <span class="value">{{
          appStore.thresholds.activeLevels
        }} / {{ constants.THRESHOLDS.presets.length }}</span>
    </div>
    <div class="col-2">
      <q-input
        data-testid="thresholds-levels-input"
        :model-value="appStore.thresholds.activeLevels"
        label="Levels"
        type="number"
        :min="1"
        :max="constants.THRESHOLDS.presets.length"
        :disable="loading"
        dense
        class="levels-input"
        @update:model-value="(v) => handleChangeCount(Number(v))"
      />
    </div>
    <div class="col-2"></div>
    <div class="col-2"></div>
    <div class="col-2"></div>
    <div class="col-1 ">
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
    </div>

  </div>

  <div v-if="localError" class="error-text row">
    {{ localError }}
  </div>


  <!-- Row 2: Threshold Days Configuration -->
  <div class="thresholds-grid config-row q-mt-md row">
    <template v-for="(level, idx) in activeThresholds" :key="`threshold-${idx}`">
      <q-input
        :label-color="level.color"
        :data-testid="`threshold-${idx}`"
        :model-value="level.days"
        :label="`${level.label}`"
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
</template>

<script setup lang="ts">
import {ref, computed} from 'vue'
import {useAppStore} from '@/stores/appStore.ts'
import {AppThresholds, DEFAULT_THRESHOLDS} from '@/models/AppThresholds.ts'
import {APP_DEFAULTS} from '@/constants.ts'
import {AgeClassification} from '@/models/tabs/AgeClassification.ts'
import type {ThresholdLevel} from '@/constants.ts'

const appStore = useAppStore()
const loading = ref(false)
const localError = ref<string | null>(null)

const constants = computed(() => APP_DEFAULTS)
const activeThresholds = computed(() => appStore.thresholds.active())

// Debug: Group tabs by ageIndex and ranges
const groupedTabCounts = computed(() => {
  const counts: Record<number, number> = {}
  const maxIdx = appStore.thresholds.active().length

  // Initialize counts for all possible age groups (0 .. maxIdx)
  for (let i = 0; i <= maxIdx; i++) {
    counts[i] = 0
  }

  // Count tabs by ageIndex
  appStore.tabs.forEach(tab => {
    const idx = (tab as any).ageIndex ?? 0
    const bounded = Math.max(0, Math.min(maxIdx, idx))
    counts[bounded] = (counts[bounded] ?? 0) + 1
  })

  return counts
})

const totalMarked = computed(() => appStore.tabs.filter(t => (t as any).isMarked).length)

function getRangeLabel(ageIdx: number): string {
  const boundaries = appStore.thresholds.toBoundaries()
  const maxIdx = appStore.thresholds.active().length

  if (ageIdx === 0) {
    const end = boundaries[0] ?? '∞'
    return `0–${end}d`
  }

  if (ageIdx > 0 && ageIdx < boundaries.length) {
    const start = (boundaries[ageIdx - 1] ?? 0) + 1
    const end = boundaries[ageIdx]
    return `${start}–${end}d`
  }

  if (ageIdx === boundaries.length) {
    const start = (boundaries[boundaries.length - 1] ?? 0) + 1
    return `${start}d+`
  }

  // Fallback
  return '—'
}

function getGroupStyle(ageIdx: number): Record<string, string> {
  const classification = new AgeClassification(ageIdx, appStore.thresholds)
  return classification.inlineStyle
}

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
    await appStore.setActiveLevels(count)
    await appStore.markOldTabs()
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

  const updated = appStore.thresholds.merge(patch)
  if (!updated.isValid()) {
    console.warn(`[Thresholds] Invalid level[${levelIdx}]=${value} rejected`)
    return
  }

  loading.value = true
  try {
    await appStore.setThresholds(patch)
    await appStore.markOldTabs()
  } finally {
    loading.value = false
  }
}

async function handleReset(): Promise<void> {
  loading.value = true
  localError.value = null
  try {
    await appStore.resetToDefaults()
    await appStore.markOldTabs()
    console.debug('[Thresholds] Reset to defaults and re-marked tabs')
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}
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

/* Compact Debug Styles */
.config-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}

.debug-label {
  font-size: 0.8rem;
  color: #666;
  font-weight: 600;
}

.debug-inline {
  display: flex;
  gap: 6px;
  align-items: center;
}

.dbg-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  min-width: 28px;
  height: 22px;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  box-shadow: none;
}

.dbg-emoji {
  font-size: 0.8rem;
  line-height: 1;
}

.dbg-num {
  font-size: 0.8rem;
  line-height: 1;
  min-width: 16px;
  text-align: center;
}

.dbg-resources {
  font-size: 0.78rem;
  color: #444;
  font-weight: 600;
}

/* remove hover/tooling noise for compact view */
.dbg-badge:hover {
  transform: none;
  box-shadow: none;
}

</style>

