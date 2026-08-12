<template>
  <div
    class="row col-12"
    data-testd="thresholds-view"
  >
    <div
      class="col-12 row items-center q-pa-md bg-grey-1 rounded-borders"
      data-testid="thresholds-config"
      style="gap: 12px"
    >
      <div class="info-box col-3">
        <div class="label">Archivum levels :</div>
        <div class="value">{{ localThresholds.activeLevels }} / {{ maxLevels }}</div>
      </div>
      <div class="col-1">
        <q-input
          data-testid="thresholds-levels-input"
          :model-value="localThresholds.activeLevels"
          label="Levels"
          type="number"
          :min="1"
          :max="maxLevels"
          :disable="store.loading.value"
          dense
          class="levels-input"
          @update:model-value="(v) => handleChangeCount(Number(v))"
        />
      </div>
      <div
        class="col-7 row items-center"
        data-testid="threshold-button"
        style="gap: 8px"
      >
        <q-btn
         v-if="hasChanges && !store.loading.value"
          data-testid="threshold-apply"
          class="q-px-md got-btn-green"
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
          class="got-btn-cyan q-px-md"
          dense
         :disable="store.loading.value"
          @click="handleReset"
        />

        <AutoCloseToggle />
      </div>
      <div
        v-if="store.error.value"
        class="error-text row"
      >
        {{ store.error.value }}
      </div>
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
      <template
        v-for="(level, idx) in activeThresholds"
        :key="`threshold-${idx}`"
      >
        <div class="col-2 q-pa-xs">
          <q-input
            :label-color="level.color"
            :data-testid="`threshold-${idx}`"
            :model-value="level.days"
            :label="level.label"
            type="number"
            :min="idx === 0 ? 0 : activeThresholds[idx - 1].days + 1"
            :max="
              idx === activeThresholds.length - 1 ? undefined : activeThresholds[idx + 1].days - 1
            "
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
import { computed, ref, onMounted, watch } from 'vue';
import { createProxyService } from '@webext-core/proxy-service';
import { useStore } from '@/composables/useStore';
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds';
import { APP_DEFAULTS, isDevEnv } from '@/constants';
import type { BackgroundRPC } from '@/services/BackgroundRPC';
import AutoCloseToggle from '@/components/AutoCloseToggle.vue';

// ⚠️ DEVELOPERS: createProxyService() returns type-safe proxy to background service worker
const background = createProxyService<BackgroundRPC>('background');

const store = useStore();
const emit = defineEmits<{ apply: [] }>();
const maxLevels = computed(() => APP_DEFAULTS.THRESHOLDS.presets.length);
const isThresholdEditingDisabled = computed<boolean>(() => store.loading.value || !isDevEnv);

// Local state to track unsaved changes
const localThresholds = ref<AppThresholds>(DEFAULT_THRESHOLDS);

const activeThresholds = computed(() => localThresholds.value.activeThresholdLevels());

// Check if there are unsaved changes
const hasChanges = computed(() => {
  if (store.loading.value) return false;

  if (localThresholds.value.activeLevels !== store.thresholds.value.activeLevels) {
    return true;
  }

  for (let i = 0; i < localThresholds.value.levels.length; i++) {
    if (localThresholds.value.levels[i].days !== store.thresholds.value.levels[i].days) {
      return true;
    }
  }

  return false;
});

async function handleChangeCount(count: number): Promise<void> {
  if (count > maxLevels.value || count < 1) return;
  localThresholds.value = localThresholds.value.withActiveLevels(count);
}

async function onChange(levelIdx: number, value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return;
  localThresholds.value = localThresholds.value.merge({ [levelIdx]: { days: value } });
}

// Apply changes and regroup tabs
async function handleApply(): Promise<void> {
  if (!hasChanges.value) return;

  try {
    // Collect threshold changes
    const changes: Record<number, Partial<{ days: number }>> = {};
    for (let i = 0; i < localThresholds.value.levels.length; i++) {
      if (localThresholds.value.levels[i].days !== store.thresholds.value.levels[i].days) {
        changes[i] = { days: localThresholds.value.levels[i].days };
      }
    }

    if (Object.keys(changes).length > 0) {
      await store.storeSetThresholds(changes);
    }

    if (localThresholds.value.activeLevels !== store.thresholds.value.activeLevels) {
      await store.storeSetActiveLevels(localThresholds.value.activeLevels);
    }

    localThresholds.value = AppThresholds.fromObject(store.thresholds.value.toJSON());

    await background.groupTabsByAge();
    emit('apply');
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('DataCloneError') || errorMsg.includes('Proxy')) {
      store.error.value = `[THRESHOLD_APPLY_PROXY_ERROR] Cannot serialize threshold data. Try refreshing the page.`;
    } else {
      store.error.value = `[THRESHOLD_APPLY_ERROR] ${errorMsg}`;
    }
    console.error('[Thresholds.handleApply]', store.error.value);
  }
}

async function handleReset(): Promise<void> {
  await store.storeResetToDefaults();
  localThresholds.value = AppThresholds.fromObject(store.thresholds.value.toJSON());

  await background.groupTabsByAge();
  emit('apply');
}

// Sync localThresholds when store changes
onMounted(() => {
  // 1️⃣ Initialize from store
  watch(
    () => store.loading.value,
    (isLoading) => {
      if (!isLoading) {
        localThresholds.value = AppThresholds.fromObject(store.thresholds.value.toJSON())
      }
    },
    { immediate: true }
  )

  // 2️⃣ Watch for external changes
  watch(
    () => store.thresholds.value.toJSON(),
    () => {
      if (!store.loading.value && !hasChanges.value) {
        localThresholds.value = AppThresholds.fromObject(store.thresholds.value.toJSON())
      }
    }
  )
});
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
