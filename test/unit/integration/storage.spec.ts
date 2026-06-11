/**
 * Integration tests: cross-component interactions via fakeBrowser storage.
 *
 * Tests that changes in one component propagate to another through
 * shared browser.storage — the real mechanism background <-> UI use.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { configStorage } from '@/utils/configStorage'
import { activatedTimestamps, mockOverrides } from '@/utils/mockStorage'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { DEFAULT_THRESHOLDS } from '@/models/AppThresholds'

beforeEach(() => {
  fakeBrowser.reset()
})

describe('storage integration: config', () => {
  it('configStorage write -> read returns same data', async () => {
    const data = { thresholds: DEFAULT_THRESHOLDS.toJSON(), configLastUpdated: Date.now() }
    await configStorage.setValue(data)
    const read = await configStorage.getValue()
    expect(read?.thresholds?.activeLevels).toBe(data.thresholds.activeLevels)
  })

  it('configStorage falls back to init value when empty', async () => {
    const val = await configStorage.getValue()
    expect(val?.thresholds).toBeDefined()
    expect(val?.configLastUpdated).toBeGreaterThan(0)
  })
})

describe('storage integration: mock overrides and activation timestamps', () => {
  it('mockOverrides can store and retrieve tab timestamps', async () => {
    await mockOverrides.setValue({ 1: 1000, 2: 2000 })
    const val = await mockOverrides.getValue()
    expect(val[1]).toBe(1000)
    expect(val[2]).toBe(2000)
  })

  it('activatedTimestamps stores activation time', async () => {
    const now = Date.now()
    await activatedTimestamps.setValue({ 42: now })
    const val = await activatedTimestamps.getValue()
    expect(val[42]).toBe(now)
  })
})

describe('integration: background service + storage', () => {
  it('uses storage thresholds via getThresholds', async () => {
    await configStorage.setValue({
      thresholds: {
        levels: [
          { key: 'YOUNG', label: 'Young', days: 2, color: 'green' },
          { key: 'OLD', label: 'Old', days: 10, color: 'red' },
        ],
        activeLevels: 2,
      },
      configLastUpdated: Date.now(),
    })

    const t = await BackgroundTabService.getThresholds()
    expect(t.activeLevels).toBe(2)
    expect(t.active()[0].days).toBe(2)
    expect(t.active()[1].days).toBe(10)
  })
})

describe('integration: config store + storage', () => {
  it('config save updates storage', async () => {
    // Import store dynamically to get fresh Pinia
    const { setActivePinia, createPinia } = await import('pinia')
    setActivePinia(createPinia())
    const { useConfigStore } = await import('@/stores/configStore')
    const store = useConfigStore()

    await store.setActiveLevels(2)
    const stored = await configStorage.getValue()
    expect(stored?.thresholds?.activeLevels).toBe(2)
  })
})
