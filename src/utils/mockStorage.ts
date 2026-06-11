import { storage } from '#imports'

/**
 * Tiny storage for mock lastAccessed overrides (debug/dev only).
 * Key: tabId, Value: custom lastAccessed timestamp.
 * Cleared automatically after groupTabsByAge() runs.
 */
export const mockOverrides = storage.defineItem<Record<number, number>>('local:mock_overrides', { fallback: {} })

/**
 * Persistent storage for real activation timestamps.
 * Set when a tab is activated (onTabActivated), used to override lastAccessed
 * since Chrome doesn't reliably update it via API.
 * Key: tabId, Value: timestamp of last activation.
 */
export const activatedTimestamps = storage.defineItem<Record<number, number>>('local:activated_timestamps', { fallback: {} })
