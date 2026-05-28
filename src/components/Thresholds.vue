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
import { ref, computed } from 'vue'
import { useGlobalStore } from '@/stores/globalStore.ts'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds.ts'

const globalStore = useGlobalStore()
const thresholds = computed(() => globalStore.thresholds)
const loading = ref(false)

async function onChange(key: keyof AppThresholds, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return

  // Validate before applying
  const updated = thresholds.value.merge({ [key]: value })
  if (!updated.isValid()) {
    console.warn(`[Thresholds] Invalid ${key}=${value} rejected`)
    return
  }

  loading.value = true
  try {
    await globalStore.setThresholds({ [key]: value })
  } finally {
    loading.value = false
  }
}

async function handleReset(): Promise<void> {
  loading.value = true
  try {
    await globalStore.setThresholds(DEFAULT_THRESHOLDS.toJSON())
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

