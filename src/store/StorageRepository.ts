/**
 * StorageRepository.ts — Unified Backend Data Access Layer
 *
 * Single class combining:
 * ✅ WXT storage definitions (appStateStorage, mockOverrides)
 * ✅ All storage operations (get, set, watch)
 * ✅ Business logic methods
 *
 * No instances needed — all static methods.
 * Used by backend service worker, services, and tests.
 *
 * CANNOT use Vue (no composables, no reactivity).
 * Pure async/await static methods only.
 */

import { storage } from 'wxt/utils/storage'
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { type ThresholdState, type AppState } from '@/models/ThresholdState'
import type { ThresholdLevel } from '@/constants'
import { APP_DEFAULTS } from '@/constants'

export class StorageRepository {
  // ──────────────────────────────────────────────────────────────────────────
  // WXT Storage Definitions
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Main configuration storage — THE PHYSICAL STORAGE
   * Uses AppState interface (plain object, WXT-friendly)
   * Persists across browser sessions automatically.
   *
   * Storage key: 'local:appState'
   * Type: AppState (plain interface, JSON-serializable)
   */
  private static readonly appStateStorage = storage.defineItem<AppState>('local:appState', {
    init: () => ({
      thresholds: {
        levels: [...APP_DEFAULTS.THRESHOLDS.presets],
        activeLevels: APP_DEFAULTS.THRESHOLDS.activeLevels,
      },
      configLastUpdated: Date.now(),
      version: '1.0.0',
      autoClose: false,  // OFF by default (opt-in)
    }),
  })

  /**
   * Mock overrides — debug/dev only
   * Key: tabId, Value: custom lastAccessed timestamp
   * Used for testing grouping logic with backdated tabs
   */
  private static readonly mockOverrides = storage.defineItem<Record<number, number>>('local:mock_overrides', {
    fallback: {},
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Public API: Storage Operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Serializes all appState writes. Each write is read → modify → write; without a queue two
   * near-simultaneous writes (e.g. auto-close toggle + thresholds Apply) both read the old state
   * and the second silently overwrites the first one's change.
   * All writes go through the background (RPC), so one in-memory queue covers every caller.
   */
  private static writeQueue: Promise<unknown> = Promise.resolve()

  /**
   * Single read-modify-write path for appState: merges `patch` into the stored state,
   * bumps configLastUpdated, and runs strictly after any previous pending write.
   */
  private static updateAppState(patch: Partial<AppState>, caller: string): Promise<void> {
    const run = async () => {
      try {
        const state = await this.appStateStorage.getValue()
        if (!state) throw new Error('Failed to read current state')
        await this.appStateStorage.setValue({ ...state, ...patch, configLastUpdated: Date.now() })
      } catch (err) {
        console.error(`[StorageRepository.${caller}] Error:`, err)
        throw err
      }
    }
    const result = this.writeQueue.then(run, run)
    this.writeQueue = result.catch(() => {}) // a failed write must not block the next one
    return result
  }

  /**
   * Get current app state from storage.
   * Returns the complete AppState object as stored.
   *
   * Used by: Backend services, tests
   * Returns: Promise<AppState | null>
   */
  static async getAppState(): Promise<AppState | null> {
    try {
      return await this.appStateStorage.getValue()
    } catch (err) {
      console.error('[StorageRepository.getAppState] Error:', err)
      return null
    }
  }

  /**
   * Get thresholds from storage as AppThresholds instance.
   * Converts plain ThresholdState → AppThresholds class for business logic.
   *
   * Returns: Promise<AppThresholds> (with fallback to defaults)
   *
   * @example
   * const thresholds = await StorageRepository.getStorageThresholds()
   * console.log(thresholds.activeThresholdLevels())  // Only active levels
   * console.log(thresholds.toBoundaries())  // [7, 14, 28, 90, 365]
   */
  static async getStorageThresholds(): Promise<AppThresholds> {
    try {
      const state = await this.appStateStorage.getValue()
      if (!state?.thresholds) {
        return DEFAULT_THRESHOLDS
      }
      // fromObject() handles the WXT array-as-object edge case and falls back to defaults.
      return AppThresholds.fromObject(state.thresholds)
    } catch (err) {
      console.error('[StorageRepository.getStorageThresholds] Error:', err)
      return DEFAULT_THRESHOLDS
    }
  }

  /**
   * Update thresholds in storage.
   * Validates and persists new threshold configuration.
   *
   * Param: levels - ThresholdLevel array, activeLevels - count of active levels
   */
  static setThresholds(levels: ThresholdLevel[], activeLevels: number): Promise<void> {
    const thresholds: ThresholdState = { levels, activeLevels }
    return this.updateAppState({ thresholds }, 'setThresholds')
  }

  /**
   * Set auto-close feature enabled/disabled.
   *
   * Param: enabled - true to enable, false to disable
   */
  static setAutoClose(enabled: boolean): Promise<void> {
    return this.updateAppState({ autoClose: enabled }, 'setAutoClose')
  }

  /**
   * Get mock overrides storage.
   * For testing/debugging only.
   *
   * Returns: Promise<Record<number, number> | undefined>
   */
  static async getMockOverrides(): Promise<Record<number, number> | undefined> {
    try {
      return await this.mockOverrides.getValue()
    } catch (err) {
      console.error('[StorageRepository.getMockOverrides] Error:', err)
      return undefined
    }
  }

  /**
   * Set mock overrides storage.
   * For testing/debugging only.
   */
  static async setMockOverrides(overrides: Record<number, number>): Promise<void> {
    try {
      await this.mockOverrides.setValue(overrides)
    } catch (err) {
      console.error('[StorageRepository.setMockOverrides] Error:', err)
      throw err
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Exports for external access (storage definitions)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Access to raw WXT storage item for advanced use cases.
   * Prefer using the static methods instead.
   * @internal
   */
  static get storage() {
    return {
      appStateStorage: this.appStateStorage,
      mockOverrides: this.mockOverrides,
    }
  }
}
