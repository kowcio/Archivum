<template>
  <div class="row config-row" data-testid="thresholds-config">
    <div class="info-box col-2">
      <span class="label">Active Levels:</span>
      <span class="value">{{ appStore.thresholds.value.activeLevels }} / {{ maxLevels }}</span>
    </div>
    <div class="col-2">
      <q-input
        data-testid="thresholds-levels-input"
        :model-value="appStore.thresholds.value.activeLevels"
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
    <div class="col-5" />
    <div class="col-1">
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
import { computed } from 'vue'
import { useAppStore } from '@/store/appStore.ts'

const appStore = useAppStore()
const maxLevels = appStore.thresholds.value.levels.length
const activeThresholds = computed(() => appStore.thresholds.value.active())

async function handleChangeCount(count: number): Promise<void> {
  if (!Number.isFinite(count) || count < 1) return
  await appStore.setActiveLevels(count)
}

async function onChange(levelIdx: number, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return
  await appStore.setThresholds({ [levelIdx]: { days: value } })
}

async function handleReset(): Promise<void> {
  await appStore.resetToDefaults()
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
.label { font-weight: 600; color: #666; }
.value { font-weight: 700; color: #1976d2; }
.levels-input { min-width: 120px; }
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
