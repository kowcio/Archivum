/**
 * useStore — Simple RPC proxy wrapper for config state
 * 
 * Single composable for all store operations via RPC.
 * Handles reactivity, loading states, and automatic sync.
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { createProxyService } from '@webext-core/proxy-service'
import { browser } from 'wxt/browser'
import type { BackgroundRPC } from '@/services/BackgroundRPC'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'

const rpc = createProxyService<BackgroundRPC>('background')

// Reactive state
const thresholds = ref<AppThresholds>(DEFAULT_THRESHOLDS)
const autoClose = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * Sync state from background
 */
async function sync(): Promise<void> {
  try {
    const state = await rpc.storeGetAppState()
    if (!state?.thresholds) return
    
    thresholds.value = new AppThresholds(state.thresholds.levels, state.thresholds.activeLevels)
    autoClose.value = state.autoClose ?? false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Sync failed'
  }
}

/**
 * Hook for Vue components
 */
export function useStore() {
  async function storeSetAutoClose(enabled: boolean): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await rpc.storeSetAutoClose(enabled)
      autoClose.value = enabled
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function storeSetThresholds(patch: Record<number, Partial<{ days: number }>>): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const updated = thresholds.value.merge(patch)
      if (!updated.isValid()) throw new Error('Invalid thresholds')
      
      // Get the current activeLevels (might have been changed separately)
      await rpc.storeSetThresholds(updated.levels, updated.activeLevels)
      thresholds.value = updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function storeSetActiveLevels(count: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const updated = thresholds.value.withActiveLevels(count)
      await rpc.storeSetThresholds(updated.levels, updated.activeLevels)
      thresholds.value = updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function storeResetToDefaults(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      thresholds.value = DEFAULT_THRESHOLDS
      await rpc.storeSetThresholds(DEFAULT_THRESHOLDS.levels, DEFAULT_THRESHOLDS.activeLevels)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  let unsubscribe: (() => void) | null = null

  onMounted(async () => {
    await sync()

    // Sync on storage changes
    const listener = () => sync()
    browser.storage.onChanged.addListener(listener)
    unsubscribe = () => browser.storage.onChanged.removeListener(listener)
  })

  onUnmounted(() => unsubscribe?.())

  return {
    // State
    thresholds,
    autoClose,
    loading,
    error,
    // Methods
    storeSetAutoClose,
    storeSetThresholds,
    storeSetActiveLevels,
    storeResetToDefaults,
    sync,
  }
}
