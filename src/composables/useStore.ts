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
import type { ThresholdLevel } from '@/constants'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'

const rpc = createProxyService<BackgroundRPC>('background')

// Reactive state
const thresholds = ref<AppThresholds>(DEFAULT_THRESHOLDS)
const autoClose = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

function serializeLevels(levels: readonly ThresholdLevel[]): ThresholdLevel[] {
  return levels.map((level) => ({
    key: level.key,
    label: level.label,
    days: level.days,
    color: level.color,
  }))
}

/**
 * Sync state from background
 */
async function sync(): Promise<void> {
  loading.value = true
  try {
    const state = await rpc.storeGetAppState()
    if (!state?.thresholds) return

    // fromObject() normalizes array-as-object storage data and falls back to defaults.
    thresholds.value = AppThresholds.fromObject(state.thresholds)
    autoClose.value = state.autoClose ?? false
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Sync failed'
  } finally {
    loading.value = false
  }
}

/**
 * Hook for Vue components
 */
/**
 * Runs a store mutation with the shared loading/error handling:
 * sets `loading`, clears `error`, records the message on failure and re-throws.
 */
async function runMutation(action: () => Promise<void>): Promise<void> {
  loading.value = true
  error.value = null
  try {
    await action()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    loading.value = false
  }
}

/** Persist thresholds via RPC, then update local state only once the write succeeded. */
async function saveThresholds(next: AppThresholds): Promise<void> {
  // Vue wraps values held by refs in reactive proxies; RPC needs plain cloneable objects.
  await rpc.storeSetThresholds(serializeLevels(next.levels), next.activeLevels)
  thresholds.value = next
}

/**
 * Hook for Vue components
 */
export function useStore() {
  const storeSetAutoClose = (enabled: boolean) => runMutation(async () => {
    await rpc.storeSetAutoClose(enabled)
    autoClose.value = enabled
  })

  /**
   * Save the complete edited thresholds (days + active level count) in ONE write.
   * ⚠️ Never split this into separate writes: after the first write `loading` flips back to false,
   *    Thresholds.vue re-syncs its local edits from the store and the second edit is silently lost.
   */
  const storeApplyThresholds = (next: AppThresholds) => runMutation(async () => {
    // Fresh plain copy: never share the caller's (reactive) level objects with store state.
    const copy = new AppThresholds(serializeLevels(next.levels), next.activeLevels)
    if (!copy.isValid()) throw new Error('Invalid thresholds')
    await saveThresholds(copy)
  })

  const storeResetToDefaults = () => runMutation(() => saveThresholds(DEFAULT_THRESHOLDS))

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
    storeApplyThresholds,
    storeResetToDefaults,
    sync,
  }
}
