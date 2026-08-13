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
      sortSettings: {
        sortByDomainInGroups: true,  // ON by default
      },
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
   * Normalize levels from storage (handle WXT edge case where arrays come as objects)
   * @private
   */
  private static _normalizeLevels(levels: ThresholdLevel[] | Record<number, ThresholdLevel> | undefined): ThresholdLevel[] {
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
   * Save app state to storage.
   * Writes complete AppState object.
   *
   * Used by: Backend services
   * Param: state - Complete AppState object to persist
   */
  static async setAppState(state: AppState): Promise<void> {
    try {
      await this.appStateStorage.setValue(state)
    } catch (err) {
      console.error('[StorageRepository.setAppState] Error:', err)
      throw err
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

      const levels = this._normalizeLevels(state.thresholds.levels)
      return new AppThresholds(levels, state.thresholds.activeLevels)
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
  static async setThresholds(levels: ThresholdLevel[], activeLevels: number): Promise<void> {
    try {
      const state = await this.appStateStorage.getValue()
      if (!state) throw new Error('Failed to read current state')

      const thresholdState: ThresholdState = {
        levels,
        activeLevels,
      }

      await this.appStateStorage.setValue({
        ...state,
        thresholds: thresholdState,
        configLastUpdated: Date.now(),
      })
    } catch (err) {
      console.error('[StorageRepository.setThresholds] Error:', err)
      throw err
    }
  }

  /**
   * Get the oldest (highest threshold days) threshold level.
   * Searches through all active threshold levels.
   *
   * Returns: Promise<ThresholdLevel | null>
   *
   * @example
   * const oldest = await StorageRepository.getOldestThresholdLevel()
   * console.log(oldest?.label)   // "Hell!"
   * console.log(oldest?.days)    // 365
   */
  static async getOldestThresholdLevel(): Promise<ThresholdLevel | null> {
    try {
      const thresholds = await this.getStorageThresholds()
      const activeLevels = thresholds.activeThresholdLevels()

      if (activeLevels.length === 0) {
        return null
      }

      // Find the threshold level with the highest days value
      const oldest = activeLevels.reduce((max, current) =>
        current.days > max.days ? current : max
      )

      return oldest
    } catch (err) {
      console.error('[StorageRepository.getOldestThresholdLevel] Error:', err)
      return null
    }
  }

  /**
   * Set auto-close feature enabled/disabled.
   *
   * Param: enabled - true to enable, false to disable
   */
  static async setAutoClose(enabled: boolean): Promise<void> {
    try {
      const state = await this.appStateStorage.getValue()
      if (!state) throw new Error('Failed to read current state')

      await this.appStateStorage.setValue({
        ...state,
        autoClose: enabled,
        configLastUpdated: Date.now(),
      })
    } catch (err) {
      console.error('[StorageRepository.setAutoClose] Error:', err)
      throw err
    }
  }

  /**
   * Get auto-close setting.
   *
   * Returns: Promise<boolean>
   */
  static async getAutoClose(): Promise<boolean> {
    try {
      const state = await this.appStateStorage.getValue()
      return state?.autoClose ?? false
    } catch (err) {
      console.error('[StorageRepository.getAutoClose] Error:', err)
      return false
    }
  }

  /**
   * Toggle domain-based sorting in groups.
   * Updates WXT storage with new sortByDomainInGroups setting.
   *
   * @example
   * await StorageRepository.setSortByDomain(true)  // Enable sorting by domain
   */
  static async setSortByDomain(enabled: boolean): Promise<void> {
    try {
      const state = await this.getAppState()
      if (!state) throw new Error('No app state to update')

      await this.setAppState({
        ...state,
        sortSettings: {
          ...state.sortSettings,
          sortByDomainInGroups: enabled,
        },
        configLastUpdated: Date.now(),
      })
    } catch (err) {
      console.error('[StorageRepository.setSortByDomain] Error:', err)
      throw err
    }
  }

  /**
   * Watch storage for external changes.
   * Used to sync changes from other contexts (e.g., other tabs, background.ts).
   *
   * Param: callback - Called with new AppState when storage changes
   * Returns: Function to unsubscribe from watcher
   */
  static watchAppState(callback: (newState: AppState | null) => void): () => void {
    return this.appStateStorage.watch(callback)
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
