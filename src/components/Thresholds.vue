<template>
  <div class="thresholds-container" data-testid="thresholds-container">
    <div class="row q-col-gutter-md items-center">
      <!-- Group 1: young boundary -->
      <div class="col-auto">
        <q-input
          data-testid="threshold-young"
          :model-value="thresholds.young"
          label="🟡 Young (days)"
          type="number"
          :min="0"
          :max="thresholds.middle - 1"
          :disable="loading"
          hint="0 → young = fresh 🟢"
          class="threshold-input"
          @update:model-value="(v) => onChange('young', Number(v))"
        />
      </div>

      <!-- Group 2: middle boundary -->
      <div class="col-auto">
        <q-input
          data-testid="threshold-middle"
          :model-value="thresholds.middle"
          label="🟠 Middle (days)"
          type="number"
          :min="thresholds.young + 1"
          :max="thresholds.old - 1"
          :disable="loading"
          hint="young → middle = 🟡"
          class="threshold-input"
          @update:model-value="(v) => onChange('middle', Number(v))"
        />
      </div>

      <!-- Group 3: old boundary -->
      <div class="col-auto">
        <q-input
          data-testid="threshold-old"
          :model-value="thresholds.old"
          label="🔴 Old (days)"
          type="number"
          :min="thresholds.middle + 1"
          :disable="loading"
          hint="middle → old = 🟠, >old = 🔴"
          class="threshold-input"
          @update:model-value="(v) => onChange('old', Number(v))"
        />
      </div>

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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useThresholds } from '@/composables/useThresholds'
import type { AppThresholds } from '@/stores/globalStore'

// 🎯 Use explicit property access instead of destructuring
const thresholdsComposable = useThresholds()
const thresholds = thresholdsComposable.thresholds
const setThreshold = thresholdsComposable.setThreshold
const resetToDefaults = thresholdsComposable.resetToDefaults

const loading = ref(false)

async function onChange(key: keyof AppThresholds, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return
  loading.value = true
  try {
    await setThreshold(key, value)
  } finally {
    loading.value = false
  }
}

async function handleReset(): Promise<void> {
  loading.value = true
  try {
    await resetToDefaults()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.thresholds-container {
  width: 100%;
}

.threshold-input {
  min-width: 130px;
}
</style>

