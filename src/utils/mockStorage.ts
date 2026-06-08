import { storage } from '#imports'

/**
 * Tiny storage for mock lastAccessed overrides (debug/dev only).
 * Key: tabId, Value: custom lastAccessed timestamp.
 * Cleared automatically after groupTabsByAge() runs.
 */
export const mockOverrides = storage.defineItem<Record<number, number>>('local:mock_overrides', { fallback: {} })
