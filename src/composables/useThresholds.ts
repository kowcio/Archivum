import { computed } from 'vue'
import { useGlobalStore, DEFAULT_THRESHOLDS, type AppThresholds } from '@/stores/globalStore'

/**
 * Composable that provides reactive threshold values backed by globalStore (Pinia).
 *
 * Responsibilities:
 *  - Read thresholds reactively from globalStore
 *  - Validate order invariant (young < middle < old) before persisting
 *  - Provide an array projection used by TabStore.getAgeClassification
 *  - Allow resetting to APP_DEFAULTS
 *
 * Usage:
 *   const { thresholds, asArray, setThreshold, resetToDefaults } = useThresholds()
 */
export function useThresholds() {
  const globalStore = useGlobalStore()

  /** Reactive thresholds object from the store */
  const thresholds = computed<AppThresholds>(() => globalStore.flags.thresholds)

  /** [young, middle, old] — the 3 boundary values passed to findIndex() in TabStore */
  const asArray = computed((): readonly [number, number, number] => [
    thresholds.value.young,
    thresholds.value.middle,
    thresholds.value.old,
  ])

  /**
   * Update a single threshold key. Silently rejects if the change would
   * violate the strict ordering invariant: young < middle < old.
   */
  async function setThreshold(key: keyof AppThresholds, value: number): Promise<void> {
    const updated: AppThresholds = { ...thresholds.value, [key]: value }
    if (!isValid(updated)) return
    await globalStore.setFlags({ thresholds: updated })
  }

  /**
   * Batch-update multiple threshold values at once.
   */
  async function setThresholds(patch: Partial<AppThresholds>): Promise<void> {
    const updated: AppThresholds = { ...thresholds.value, ...patch }
    if (!isValid(updated)) return
    await globalStore.setFlags({ thresholds: updated })
  }

  /** Restore all thresholds to the values defined in APP_DEFAULTS. */
  async function resetToDefaults(): Promise<void> {
    await globalStore.setFlags({ thresholds: { ...DEFAULT_THRESHOLDS } })
  }

  return {
    thresholds,
    asArray,
    setThreshold,
    setThresholds,
    resetToDefaults,
    DEFAULT_THRESHOLDS,
  }
}

/** Validates strict ordering: 0 ≤ young < middle < old */
export function isValid(t: AppThresholds): boolean {
  return t.young >= 0 && t.middle > t.young && t.old > t.middle
}

