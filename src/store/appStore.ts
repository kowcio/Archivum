/**
 * appStore.ts — Unified Store for Extension
 *
 * This is the ONLY store file needed. Contains:
 * 1. WXT Storage Definitions (persistent data) — using plain interfaces
 * 2. Vue Composable Wrapper (reactive binding) — uses AppThresholds for business logic
 *
 * EVERYTHING app-related lives here:
 * ├─ Storage items (appStateStorage) — uses ThresholdState interface
 * ├─ Helper functions (getStorageThresholds)
 * └─ Vue composable (useAppStore for components)
 *
 * Key Design:
 * - Storage layer uses PLAIN INTERFACES (ThresholdState, AppState) ✅
 * - Business logic layer uses CLASSES (AppThresholds) for methods ✅
 * - NO toRaw()/unref() needed — structuredClone works with plain objects ✅
 *
 * Used by:
 * ✅ Vue components: import { useAppStore } from '@/store/appStore'
 * ✅ Background service: import { appStateStorage, getStorageThresholds } from '@/store/appStore'
 * ✅ Tests: import { appStateStorage } from '@/store/appStore'
 */

import { ref, onMounted, type Ref } from 'vue'
import { storage } from 'wxt/utils/storage'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds.ts'
import { type ThresholdState, type AppState, isValidThresholdState } from '@/models/ThresholdState.ts'
import type { ThresholdLevel } from '@/constants.ts'
import { APP_DEFAULTS } from '@/constants.ts'

/**
 * ════════════════════════════════════════════════════════════════════
 * PART 1: WXT STORAGE DEFINITIONS (Single Source of Truth)
 * Using PLAIN INTERFACES for 100% WXT compatibility
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Main configuration storage — THE PRIMARY STORE
 * Uses AppState interface (plain object, WXT-friendly)
 * No class instances, no .toJSON() workarounds needed!
 */
export const appStateStorage = storage.defineItem<AppState>('local:appState', {
  init: () => ({
    thresholds: {
      levels: [...APP_DEFAULTS.THRESHOLDS.presets],
      activeLevels: APP_DEFAULTS.THRESHOLDS.activeLevels,
    },
    configLastUpdated: Date.now(),
    version: '1.0.0',
    sortSettings: {
      sortByDomainInGroups: true,  // ON by default
    },
  }),
})

/**
 * Mock overrides — debug/dev only
 * Key: tabId, Value: custom lastAccessed timestamp
 * Used for testing grouping logic with backdated tabs
 */
export const mockOverrides = storage.defineItem<Record<number, number>>('local:mock_overrides', {
  fallback: {},
})


/**
 * Helper: Normalize levels from storage (handle WXT edge case where arrays come as objects)
 */
function normalizeLevels(levels: ThresholdLevel[] | Record<number, ThresholdLevel> | undefined): ThresholdLevel[] {
  if (Array.isArray(levels)) return levels
  if (typeof levels === 'object' && levels !== null) {
    return Object.values(levels).filter(
      (item): item is ThresholdLevel =>
        item && typeof item === 'object' && 'days' in item && 'key' in item
    )
  }
  return []
}

/**
 * Helper: Get thresholds from storage as AppThresholds instance (for background.ts + services)
 * Converts plain ThresholdState → AppThresholds class for business logic
 *
 * Used by: BackgroundTabService, tests
 */
export async function getStorageThresholds(): Promise<AppThresholds> {
  try {
    const state = await appStateStorage.getValue()
    if (!state?.thresholds) {
      return DEFAULT_THRESHOLDS
    }

    const levels = normalizeLevels(state.thresholds.levels)
    return new AppThresholds(levels, state.thresholds.activeLevels)
  } catch (err) {
    console.error('[getStorageThresholds] Error:', err)
    return DEFAULT_THRESHOLDS
  }
}


/**
 * ════════════════════════════════════════════════════════════════════
 * PART 2: VUE COMPOSABLE WRAPPER (Reactive Binding)
 * ════════════════════════════════════════════════════════════════════
 * Provides Vue reactivity around WXT storage.
 *
 * ⚡ SINGLETON PATTERN: refs live at module level so every
 *    useAppStore() caller shares the SAME reactive state.
 * ⚡ Storage layer: plain ThresholdState (interface)
 * ⚡ Vue layer: AppThresholds class (for business logic methods)
 */

type UseAppStoreReturn = {
  // Reactive state — exposed as AppThresholds for business logic
  thresholds: Ref<AppThresholds>
  configLastUpdated: Ref<number>
  loading: Ref<boolean>
  error: Ref<string | null>

  // Actions
  load(): Promise<void>
  save(): Promise<void>
  setThresholds(patch: Record<number, Partial<{ days: number }>>): Promise<void>
  setActiveLevels(count: number): Promise<void>
  resetToDefaults(): Promise<void>
}

// ── Module-level singleton refs (shared across all useAppStore() callers) ──
const thresholds = ref<AppThresholds>(DEFAULT_THRESHOLDS)
const configLastUpdated = ref<number>(Date.now())
const loading = ref<boolean>(false)
const error = ref<string | null>(null)
let storageWatcherSetup = false

/**
 * Main composable — call this in any Vue component to get reactive app state.
 *
 * ⚡ SINGLETON — every caller reads/writes the SAME refs.
 * Returns AppThresholds for business logic, but internally syncs with plain ThresholdState in storage.
 *
 * Example: const { thresholds, save } = useAppStore()
 */
export function useAppStore(): UseAppStoreReturn {
  // ── shared refs are at module level ↑, these inner functions
  //    always read/write the SAME refs ──

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const state = await appStateStorage.getValue()
      if (state?.thresholds && isValidThresholdState(state.thresholds)) {
        const levels = normalizeLevels(state.thresholds.levels)
        thresholds.value = new AppThresholds(levels, state.thresholds.activeLevels)
        configLastUpdated.value = state.configLastUpdated
      }
    } catch (err) {
      error.value = `[LOAD_ERROR] ${err instanceof Error ? err.message : 'Failed to load'}`
      thresholds.value = DEFAULT_THRESHOLDS
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const thresholdState: ThresholdState = {
        levels: thresholds.value.levels,
        activeLevels: thresholds.value.activeLevels,
      }

      await appStateStorage.setValue({
        thresholds: thresholdState,
        configLastUpdated: Date.now(),
        version: '1.0.0',
      })
      configLastUpdated.value = Date.now()
    } catch (err: any) {
      error.value = `[SAVE_ERROR] ${err instanceof Error ? err.message : String(err)}`
      console.error('[appStore.save]', error.value)
    } finally {
      loading.value = false
    }
  }

  async function setThresholds(patch: Record<number, Partial<{ days: number }>>): Promise<void> {
    try {
      const updated = thresholds.value.merge(patch)
      if (!updated.isValid()) {
        throw new Error('Thresholds not strictly increasing')
      }
      thresholds.value = updated
      await save()
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = `[SET_THRESHOLDS_ERROR] ${msg}`
      console.error('[appStore.setThresholds]', error.value)
      throw err
    }
  }

  async function setActiveLevels(count: number): Promise<void> {
    try {
      thresholds.value = thresholds.value.withActiveLevels(count)
      await save()
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = `[SET_ACTIVE_LEVELS_ERROR] ${msg}`
      console.error('[appStore.setActiveLevels]', error.value)
      throw err
    }
  }

  async function resetToDefaults(): Promise<void> {
    try {
      thresholds.value = DEFAULT_THRESHOLDS
      await save()
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = `[RESET_ERROR] ${msg}`
      console.error('[appStore.resetToDefaults]', error.value)
      throw err
    }
  }

  function setupStorageWatcher(): void {
    if (storageWatcherSetup) return
    storageWatcherSetup = true

    appStateStorage.watch((newState) => {
      if (!newState?.thresholds || !isValidThresholdState(newState.thresholds)) return
      if (newState.configLastUpdated === configLastUpdated.value) return

      try {
        const levels = normalizeLevels(newState.thresholds.levels)
        const updated = new AppThresholds(levels, newState.thresholds.activeLevels)
        thresholds.value = updated
        configLastUpdated.value = newState.configLastUpdated
      } catch (err) {
        console.error('[appStore.watch]', err)
      }
    })
  }

  onMounted(async () => {
    await load()
    setupStorageWatcher()
  })

  return {
    thresholds,
    configLastUpdated,
    loading,
    error,
    load,
    save,
    setThresholds,
    setActiveLevels,
    resetToDefaults,
  }
}

