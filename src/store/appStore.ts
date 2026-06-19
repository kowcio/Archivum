/**
 * appStore.ts — Unified Store for Extension
 *
 * This is the ONLY store file needed. Contains:
 * 1. WXT Storage Definitions (persistent data)
 * 2. Vue Composable Wrapper (reactive binding)
 *
 * EVERYTHING app-related lives here:
 * ├─ Storage items (appStateStorage, mockOverrides)
 * ├─ Helper functions (getStorageThresholds)
 * └─ Vue composable (useAppStore for components)
 *
 * Used by:
 * ✅ Vue components: import { useAppStore } from '@/store/appStore'
 * ✅ Background service: import { appStateStorage, getStorageThresholds } from '@/store/appStore'
 * ✅ Tests: import { appStateStorage, mockOverrides } from '@/store/appStore'
 */

import { ref, onMounted, type Ref } from 'vue'
import { storage } from '#imports'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds.ts'
import type { ThresholdLevel } from '@/constants.ts'

/**
 * ════════════════════════════════════════════════════════════════════
 * PART 1: WXT STORAGE DEFINITIONS (Single Source of Truth)
 * ════════════════════════════════════════════════════════════════════
 * These are used by:
 * - useAppStore() composable (for Vue)
 * - Background service (direct access)
 * - Tests (direct access)
 */

/**
 * Complete app state structure — persisted in browser.storage.local
 */
export interface AppState {
  thresholds: {
    levels: ThresholdLevel[]
    activeLevels: number
  }
  configLastUpdated: number
  version: string
}

/**
 * Main configuration storage — THE PRIMARY STORE
 * Used by: Vue composable, background service, tests
 */
export const appStateStorage = storage.defineItem<AppState>('local:appState', {
  init: () => ({
    thresholds: DEFAULT_THRESHOLDS.toJSON(),
    configLastUpdated: Date.now(),
    version: '1.0.0',
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
 * Helper: Get thresholds from storage (for background.ts + services)
 * Direct async access — no reactivity needed in background context
 * Used by: BackgroundTabService, tests
 */
export async function getStorageThresholds(): Promise<AppThresholds> {
  const state = await appStateStorage.getValue()
  if (state?.thresholds?.levels) {
    return AppThresholds.fromObject(state.thresholds)
  }
  return DEFAULT_THRESHOLDS
}

/**
 * ════════════════════════════════════════════════════════════════════
 * PART 2: VUE COMPOSABLE WRAPPER (Reactive Binding)
 * ════════════════════════════════════════════════════════════════════
 * Provides Vue reactivity around WXT storage
 * Used by: Vue components in popup/options
 */

type UseAppStoreReturn = {
  // Reactive state
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

let storageWatcherSetup = false

/**
 * Main composable — call this in any Vue component to get reactive app state
 * Example: const { thresholds, save } = useAppStore()
 */
export function useAppStore(): UseAppStoreReturn {
  // Reactive refs — mirror storage state
  const thresholds = ref<AppThresholds>(DEFAULT_THRESHOLDS)
  const configLastUpdated = ref<number>(Date.now())
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  /**
   * Load initial state from storage
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const state = await appStateStorage.getValue()
      if (state?.thresholds) {
        thresholds.value = AppThresholds.fromObject(state.thresholds)
        configLastUpdated.value = state.configLastUpdated
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load app state'
      thresholds.value = DEFAULT_THRESHOLDS
    } finally {
      loading.value = false
    }
  }

  /**
   * Persist current state to storage
   */
  async function save(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const newTimestamp = Date.now()
      await appStateStorage.setValue({
        thresholds: thresholds.value.toJSON(),
        configLastUpdated: newTimestamp,
        version: '1.0.0',
      })
      configLastUpdated.value = newTimestamp
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save app state'
    } finally {
      loading.value = false
    }
  }

  /**
   * Update threshold levels (partial)
   */
  async function setThresholds(patch: Record<number, Partial<{ days: number }>>): Promise<void> {
    const updated = thresholds.value.merge(patch)
    if (!updated.isValid()) return
    thresholds.value = updated
    await save()
  }

  /**
   * Update active levels count
   */
  async function setActiveLevels(count: number): Promise<void> {
    thresholds.value = thresholds.value.withActiveLevels(count)
    await save()
  }

  /**
   * Reset to defaults
   */
  async function resetToDefaults(): Promise<void> {
    thresholds.value = DEFAULT_THRESHOLDS
    await save()
  }

  /**
   * Setup storage watcher — fires when storage changes in ANY context
   * Enables automatic sync across popup, options, background contexts
   */
  function setupStorageWatcher(): void {
    // Setup watcher only once globally (avoid duplicate listeners)
    if (storageWatcherSetup) return
    storageWatcherSetup = true

    appStateStorage.watch((newState) => {
      if (!newState?.thresholds) return
      if (newState.configLastUpdated === configLastUpdated.value) return

      try {
        const updated = AppThresholds.fromObject(newState.thresholds)
        if (!updated.isValid()) {
          console.warn('[appStore] Invalid thresholds from storage, skipping sync')
          return
        }
        thresholds.value = updated
        configLastUpdated.value = newState.configLastUpdated
        console.log('[appStore] ✅ Synced from storage (another context changed config)')
      } catch (err) {
        console.error('[appStore] Storage sync failed:', err)
      }
    })
  }

  /**
   * Auto-init on mount
   */
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

