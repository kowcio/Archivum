/**
 * ThresholdState — Storage Type Definitions
 *
 * These interfaces define what is actually stored in WXT storage.
 * They are PLAIN OBJECTS (no class methods), making them 100% compatible
 * with WXT's structured clone serialization.
 *
 * Benefits:
 * - ✅ No DataCloneError (structuredClone friendly)
 * - ✅ Full TypeScript autocomplete
 * - ✅ No toRaw(unref()) needed
 * - ✅ Works with WXT storage.defineItem<T>()
 */

import type { ThresholdLevel } from '@/constants'

/**
 * Single threshold state (plain object, WXT-compatible)
 *
 * Example:
 * ```
 * { levels: [...], activeLevels: 3 }
 * ```
 */
export interface ThresholdState {
  levels: ThresholdLevel[]
  activeLevels: number
}

/**
 * Complete app state stored in WXT storage
 *
 * Used by: storage.defineItem<AppState>()
 */
export interface AppState {
  thresholds: ThresholdState
  configLastUpdated: number
  version: string
}
/**
 * Validate threshold state
 */
export function isValidThresholdState(state: ThresholdState): boolean {
  if (!state?.levels || state.levels.length === 0) return false
  if (state.activeLevels < 1 || state.activeLevels > state.levels.length) return false

  // Check strict ordering: days must increase
  const active = state.levels.slice(0, state.activeLevels)
  if (active[0]?.days < 0) return false
  for (let i = 1; i < active.length; i++) {
    if (active[i].days <= active[i - 1].days) return false
  }
  return true
}

/**
 * Get active levels from threshold state
 */
export function getActiveThresholds(state: ThresholdState): ThresholdLevel[] {
  return state.levels.slice(0, state.activeLevels)
}

/**
 * Merge partial changes into threshold state
 */
export function mergeThresholdState(
  current: ThresholdState,
  patch: Record<number, Partial<ThresholdLevel>>
): ThresholdState {
  const updated = current.levels.map((level, idx) => {
    const patchByIndex = patch[idx]
    if (!patchByIndex) return level
    return {
      key: patchByIndex.key ?? level.key,
      label: patchByIndex.label ?? level.label,
      days: patchByIndex.days ?? level.days,
      color: patchByIndex.color ?? level.color,
    }
  })
  return { ...current, levels: updated }
}

/**
 * Update active levels count
 */
export function updateActiveThresholds(state: ThresholdState, count: number): ThresholdState {
  return {
    ...state,
    activeLevels: Math.max(1, Math.min(count, state.levels.length)),
  }
}

