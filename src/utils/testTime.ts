/**
 * 🧪 DEV-ONLY: Time manipulation for testing aging behavior
 *
 * In dev mode, allows simulating time passage without waiting days.
 * Tabs appear older relative to the fake "current time".
 *
 * Storage: timeOffset (milliseconds added to Date.now())
 * Usage: import { getCurrentTime, addTimeOffset } from '@/utils/testTime'
 */

import { browser } from 'wxt/browser'

const TIME_OFFSET_KEY = 'dev:timeOffset'

/**
 * Get the current "fake" time in milliseconds.
 * In production: returns Date.now()
 * In dev mode: returns Date.now() + stored offset
 *
 * All time-sensitive code should use this instead of Date.now()
 */
export async function getCurrentTime(): Promise<number> {
  try {
    const data = await browser.storage.local.get(TIME_OFFSET_KEY)
    const offset = (data[TIME_OFFSET_KEY] as number | undefined) ?? 0
    return Date.now() + offset
  } catch {
    return Date.now() // Fallback to real time if storage fails
  }
}

/**
 * Add milliseconds to the fake time offset.
 * Returns new offset value.
 *
 * @param ms - milliseconds to add (can be negative to go back in time)
 * @returns new total offset in ms
 */
export async function addTimeOffset(ms: number): Promise<number> {
  try {
    const data = await browser.storage.local.get(TIME_OFFSET_KEY)
    const currentOffset = (data[TIME_OFFSET_KEY] as number | undefined) ?? 0
    const newOffset = currentOffset + ms
    await browser.storage.local.set({ [TIME_OFFSET_KEY]: newOffset })
    console.log(`[TestTime] Time offset: ${currentOffset} → ${newOffset} ms (+${ms} ms, +${Math.floor(ms / 3600000)}h)`)
    return newOffset
  } catch (err) {
    console.error('[TestTime] Failed to update time offset:', err)
    throw err
  }
}

/**
 * Reset fake time back to real time.
 */
export async function resetTimeOffset(): Promise<void> {
  try {
    await browser.storage.local.remove(TIME_OFFSET_KEY)
    console.log('[TestTime] Time offset reset to real time')
  } catch (err) {
    console.error('[TestTime] Failed to reset time offset:', err)
  }
}

/**
 * Get the current offset without adding more time.
 * Used for logging/debugging.
 */
export async function getTimeOffset(): Promise<number> {
  try {
    const data = await browser.storage.local.get(TIME_OFFSET_KEY)
    return (data[TIME_OFFSET_KEY] as number | undefined) ?? 0
  } catch {
    return 0
  }
}

