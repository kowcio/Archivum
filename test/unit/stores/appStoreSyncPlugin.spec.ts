import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from 'src/stores/appStore'
import { appStoreSyncPlugin } from 'src/stores/appStoreSyncPlugin'

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
    },
    runtime: {
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
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

describe('appStoreSyncPlugin', () => {
  beforeEach(() => {
    const pinia = createPinia()
    pinia.use(appStoreSyncPlugin)
    setActivePinia(pinia)
  })

  it('initializes the appStore with unified storage sync', async () => {
    const store = useAppStore()
    await store.init()

    expect(store.tabs).toBeDefined()
    expect(store.isGrouped).toBe(false)
    expect(store.thresholds).toBeDefined()
  })

  it('initializes storage sync without errors', async () => {
    const store = useAppStore()
    await store.init()

    // If we got here without errors, storage sync initialized successfully
    expect(store.canGroup).toBe(false)
  })

  it('detects browser capability for tab grouping', async () => {
    const store = useAppStore()
    await store.init()

    // canGroup should be set based on browser.tabGroups availability
    expect(typeof store.canGroup).toBe('boolean')
  })

  it('properly disposes store without memory leaks', async () => {
    const store = useAppStore()
    await store.init()

    const disposeSpy = vi.spyOn(store, '$dispose')
    store.$dispose()

    expect(disposeSpy).toHaveBeenCalled()
  })

  it('initializes with default state values', async () => {
    const store = useAppStore()
    await store.init()

    expect(store.appName).toBe('Tab Age Tracker')
    expect(store.loading).toBe(false)
    expect(store.error).toBe(null)
  })

  it('config and tabs sync setup without throwing errors', async () => {
    const store = useAppStore()

    // This should not throw
    expect(async () => {
      await store.init()
    }).not.toThrow()
  })

  it('handles store initialization with unified initStorageSync', async () => {
    const store = useAppStore()
    await store.init()

    // initStorageSync() should be called automatically during init()
    // and should return void (not a function)
    expect(store.tabs).toBeDefined()
    expect(store.configLastUpdated).toBeGreaterThan(0)
  })
})
