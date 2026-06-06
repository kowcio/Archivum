<template>
  <div class="thresholds-config" data-testid="thresholds-config">
    <!-- Section 1: Threshold Levels Management -->
    <div class="config-section">
      <h6 class="section-header">Configure Threshold Levels</h6>
      <div class="row q-col-gutter-md items-center">
        <!-- Display current count -->
        <div class="col-auto">
          <div class="info-box">
            <span class="label">Active Levels:</span>
            <span class="value">{{ globalStore.thresholds.activeLevels }} / {{ constants.THRESHOLDS.presets.length }}</span>
          </div>
        </div>

        <!-- Input to change count -->
        <div class="col-auto">
          <q-input
            data-testid="thresholds-levels-input"
            :model-value="globalStore.thresholds.activeLevels"
            label="# Levels"
            type="number"
            :min="3"
            :max="constants.THRESHOLDS.presets.length"
            :disable="loading"
            dense
            class="threshold-levels-input"
            @update:model-value="(v) => handleChangeCount(Number(v))"
          />
        </div>

        <!-- Display active presets list -->
        <div class="col">
          <div class="preset-list">
            <div v-for="(level, idx) in activeThresholds" :key="`active-preset-${idx}`" class="preset-item active">
              <span class="preset-label">{{ level.label }}</span>
              <span class="preset-days">({{ level.days }}d)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Error message for levels change -->
      <div v-if="localError" class="error-text q-mt-sm">
        Error: {{ localError }}
      </div>
    </div>

    <!-- Section 2: Threshold Values Configuration -->
    <div class="config-section q-mt-lg">
      <h6 class="section-header">Configure Threshold Days</h6>
      <div class="row q-col-gutter-md items-center">
        <!-- Dynamic threshold inputs -->
        <template v-for="(level, idx) in activeThresholds" :key="`threshold-${idx}`">
          <div class="col-auto">
            <q-input
              :data-testid="`threshold-${idx}`"
              :model-value="level.days"
              :label="`${getLevelEmoji(idx)} ${level.label} (days)`"
              type="number"
              :min="idx === 0 ? 0 : activeThresholds[idx - 1].days + 1"
              :max="idx === activeThresholds.length - 1 ? undefined : activeThresholds[idx + 1].days - 1"
              :disable="loading"
              :hint="getHint(idx, level.label)"
              class="threshold-input"
              @update:model-value="(v) => onChange(idx, Number(v))"
            />
          </div>
        </template>

        <!-- Reset button -->
        <div class="col-auto">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGlobalStore } from '@/stores/globalStore.ts'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds.ts'
import { APP_DEFAULTS } from '@/constants.ts'
import type { ThresholdLevel } from '@/constants.ts'

const globalStore = useGlobalStore()
const loading = ref(false)
const localError = ref<string | null>(null)

const constants = computed(() => APP_DEFAULTS)
const activeThresholds = computed(() => globalStore.thresholds.active())

function getLevelEmoji(idx: number): string {
  const emojis = ['🟢', '🟡', '🟠', '🔴', '🔴', '🔴', '💀']
  return emojis[idx] ?? '⚫'
}

function getHint(idx: number, label: string): string {
  if (idx === 0) return `0 → ${label} = fresh 🟢`
  const prev = activeThresholds.value[idx - 1]
  return `${prev.label} → ${label}`
}

async function handleChangeCount(count: number): Promise<void> {
  if (!Number.isFinite(count) || count < 3) return

  loading.value = true
  localError.value = null
  try {
    await globalStore.setActiveLevels(count)
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

async function onChange(levelIdx: number, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return

  // Preserve other fields, update only days
  const currentLevel = activeThresholds.value[levelIdx]
  const patch: Record<string, Partial<ThresholdLevel>> = {
    [levelIdx]: {
      key: currentLevel.key,
      label: currentLevel.label,
      days: value,
      color: currentLevel.color,
    }
  }

  // Validate before applying
  const updated = globalStore.thresholds.merge(patch)
  if (!updated.isValid()) {
    console.warn(`[Thresholds] Invalid level[${levelIdx}]=${value} rejected`)
    return
  }

  loading.value = true
  try {
    await globalStore.setThresholds(patch)
  } finally {
    loading.value = false
  }
}

async function handleReset(): Promise<void> {
  loading.value = true
  try {
    // Reset to default active thresholds
    const defaultActive = new AppThresholds(
      DEFAULT_THRESHOLDS.levels,
      DEFAULT_THRESHOLDS.activeLevels
    )
    await globalStore.setThresholds(defaultActive.toJSON() as any)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.thresholds-config {
  width: 100%;
}

.config-section {
  padding: 1rem;
  background: #fafafa;
  border-radius: 6px;
  border-left: 4px solid #1976d2;
}

.section-header {
  margin: 0 0 0.8rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  padding-bottom: 0.4rem;
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
}

.label {
  font-weight: 600;
  color: #666;
}

.value {
  font-weight: 700;
  color: #1976d2;
}

.threshold-levels-input {
  max-width: 80px;
}

.threshold-input {
  min-width: 130px;
}

.preset-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.preset-item {
  display: inline-flex;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 0.85rem;
  background: #e3f2fd;
  border: 1px solid #1976d2;
  color: #0d47a1;
  font-weight: 500;
}

.preset-label {
  font-weight: 500;
}

.preset-days {
  opacity: 0.8;
  font-size: 0.8rem;
}

.error-text {
  font-size: 0.8rem;
  color: #d32f2f;
}
</style>

