import { storage } from '#imports'
import { DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import type { ThresholdLevel } from '@/constants'

/**
 * Single typed storage item for extension configuration (thresholds).
 * Replaces StorageService + tabStorage — WXT handles browser.storage natively.
 *
 * Architecture:
 *   background reads config → groups tabs
 *   options writes config ← user changes thresholds
 *   storage.watch() syncs across all open contexts
 */
export interface PersistedConfig {
  thresholds: { levels: ThresholdLevel[]; activeLevels: number }
  configLastUpdated: number
}

export const configStorage = storage.defineItem<PersistedConfig>('local:config', {
  init: () => ({
    thresholds: DEFAULT_THRESHOLDS.toJSON(),
    configLastUpdated: Date.now(),
  }),
})
