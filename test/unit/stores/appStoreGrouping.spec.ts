import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from 'src/stores/appStore'
import browser from 'webextension-polyfill'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      get: vi.fn(() => Promise.resolve({ id: 1, url: 'http://example.com' })),
      onActivated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      move: vi.fn(async () => []),
      ungroup: vi.fn(async () => undefined),
    },
    runtime: {
      // Return plain objects (not Proxies) to avoid DataCloneError
      sendMessage: vi.fn(async () => ({ groupsCreated: 0, error: null })),
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
    },
    alarms: {
      create: vi.fn(),
      onAlarm: {
        addListener: vi.fn(),
      },
    },
    tabGroups: null,
  },
}))

vi.mock('@/constants', () => ({
  APP_CONSTANTS: {
    APP_NAME: 'Tab Age Tracker',
    STORE_GLOBAL_STORE: 'global_store',
    APP_VERSION: '1.0.0-test',
  },
  APP_DEFAULTS: {
    THRESHOLDS: {
      presets: [
        { key: 'WEEK', label: 'Week', days: 7, color: 'green' },
        { key: 'WEEKS_2', label: '2 Weeks', days: 14, color: 'blue' },
        { key: 'WEEKS_3', label: '3 Weeks', days: 21, color: 'yellow' },
        { key: 'MONTH', label: 'Month', days: 30, color: 'red' },
      ],
    },
  },
}))

vi.mock('@/services/StorageService', () => ({
  default: {
    get: vi.fn(() => Promise.resolve(undefined)),
    set: vi.fn(() => Promise.resolve()),
    onChanged: vi.fn(() => {}),
  },
}))

vi.mock('@/utils/tabStorage', () => ({
  tabStorageItem: {
    getValue: vi.fn(() => Promise.resolve(null)),
    setValue: vi.fn(() => Promise.resolve()),
    watch: vi.fn(() => () => {}),
  },
}))

describe('appStore groupTabsByAge action', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  it('sends message to background without DataCloneError', async () => {
    const store = useAppStore()
    await store.init()

    // This should NOT throw DataCloneError
    const result = await store.groupTabsByAge()

    expect(result).toBe(0) // Should be 0 because canGroup is false
  })

  it('detects when grouping is not supported (Firefox)', async () => {
    const store = useAppStore()
    await store.init()

    // canGroup should be false (mocked tabGroups = null)
    expect(store.canGroup).toBe(false)

    const result = await store.groupTabsByAge()
    expect(result).toBe(0)
    expect(store.error).toBe('Tab grouping not supported in this browser')
  })

  it('handles successful grouping response from background', async () => {
    const store = useAppStore()
    await store.init()

    // Mock Chrome-like response
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({
      groupsCreated: 3,
      error: null,
    })

    // Simulate Chrome with tabGroups support
    store.canGroup = true

    const result = await store.groupTabsByAge()

    // Should call sendMessage with correct action
    expect(vi.mocked(browser.runtime.sendMessage)).toHaveBeenCalledWith({
      action: 'groupTabsByAge',
    })
  })

  it('handles error response from background', async () => {
    const store = useAppStore()
    await store.init()

    // Mock error response
    vi.mocked(browser.runtime.sendMessage).mockResolvedValueOnce({
      groupsCreated: 0,
      error: 'Background service worker failed',
    })

    store.canGroup = true

    const result = await store.groupTabsByAge()

    expect(result).toBe(0)
    expect(store.error).toBe('Background service worker failed')
  })

  it('ungroupAllTabs uses universal browser API without Proxy error', async () => {
    const store = useAppStore()
    await store.init()

    // Add a mock tab
    store.tabs = [{ id: 1, url: 'http://example.com' } as any]
    store.isGrouped = true

    // This should NOT throw DataCloneError
    await expect(store.ungroupAllTabs()).resolves.not.toThrow()

    expect(store.isGrouped).toBe(false)
  })
})
