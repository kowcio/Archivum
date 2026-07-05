/**
 * Integration tests: cross-component interactions via fakeBrowser storage.
 *
 * Tests that changes in one component propagate to another through
 * shared browser.storage — the real mechanism background <-> UI use.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { appStateStorage, mockOverrides } from '@/store/appStore.ts'
import { BackgroundTabService } from '@/services/BackgroundTabService'
import { DEFAULT_THRESHOLDS } from '@/models/AppThresholds'
import { ThemeColor } from '@/constants'

beforeEach(() => {
  fakeBrowser.reset()
})

describe('storage integration: config', () => {
  it('appStateStorage write -> read returns same data', async () => {
    const data = { thresholds: DEFAULT_THRESHOLDS.toJSON(), configLastUpdated: Date.now(), version: '1.0.0' }
    await appStateStorage.setValue(data)
    const read = await appStateStorage.getValue()
    expect(read?.thresholds?.activeLevels).toBe(data.thresholds.activeLevels)
  })

  it('appStateStorage falls back to init value when empty', async () => {
    const val = await appStateStorage.getValue()
    expect(val?.thresholds).toBeDefined()
    expect(val?.configLastUpdated).toBeGreaterThan(0)
  })
})

describe('storage integration: mock overrides', () => {
  it('mockOverrides can store and retrieve tab timestamps', async () => {
    await mockOverrides.setValue({ 1: 1000, 2: 2000 })
    const val = await mockOverrides.getValue()
    expect(val[1]).toBe(1000)
    expect(val[2]).toBe(2000)
  })
})

describe('integration: background service + storage', () => {
  it('uses storage thresholds via getThresholds', async () => {
    await appStateStorage.setValue({
      thresholds: {
        levels: [
          { key: 'YOUNG', label: 'Young', days: 2, color: ThemeColor.Green },
          { key: 'OLD', label: 'Old', days: 10, color: ThemeColor.Red },
        ],
        activeLevels: 2,
      },
      configLastUpdated: Date.now(),
      version: '1.0.0',
    })

    const t = await BackgroundTabService.getThresholds()
    expect(t.activeLevels).toBe(2)
    expect(t.active()[0].days).toBe(2)
    expect(t.active()[1].days).toBe(10)
  })
})

describe('integration: app store + storage', () => {
  it('app state persists to storage', async () => {
    const initialState = await appStateStorage.getValue()
    expect(initialState?.thresholds).toBeDefined()
    expect(initialState?.configLastUpdated).toBeGreaterThan(0)

    // Simulate a config change
    const newState: typeof initialState = {
      thresholds: initialState?.thresholds ?? DEFAULT_THRESHOLDS.toJSON(),
      configLastUpdated: Date.now(),
      version: initialState?.version ?? '1.0.0',
    }
    await appStateStorage.setValue(newState)
    const stored = await appStateStorage.getValue()
    expect(stored?.configLastUpdated).toBe(newState.configLastUpdated)
  })
})
