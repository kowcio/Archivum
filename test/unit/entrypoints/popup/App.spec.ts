import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from 'src/entrypoints/popup/App.vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from 'src/stores/appStore'

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
    tabGroups: null, // Firefox-compatible default (no tab groups)
  },
}))

vi.mock('@/constants', () => ({
  APP_CONSTANTS: {
    APP_NAME: 'Tab Age Tracker',
    APP_ID: 'TabAgeTracker',
    STORE_GLOBAL_STORE: 'global_store',
    STORE_TAB_STORE: 'tab_store',
    APP_VERSION: '1.0.0-20240101-00:00',
  },
  THEME_COLORS: {
    green: '#188038',
    blue: '#1f73e7',
    yellow: '#f9ab00',
    red: '#d33b27',
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
    remove: vi.fn(() => Promise.resolve()),
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

describe('Popup App.vue', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the popup component', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.vm).toBeDefined()
    expect(wrapper.exists()).toBe(true)
  })

  it('initializes with empty tabs list', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.vm.$nextTick()
    const store = useAppStore()
    expect(store.tabs).toEqual([])
  })

  it('initializes app store during mount', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.vm.$nextTick()
    const store = useAppStore()
    expect(store.appName).toBeDefined()
    expect(store.version).toBeDefined()
    expect(store.thresholds).toBeDefined()
  })

  it('detects browser capability (canGroup)', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.vm.$nextTick()
    const store = useAppStore()
    // Should be false since we mocked tabGroups as null
    expect(store.canGroup).toBe(false)
  })

  it('properly initializes storage sync without errors', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
      },
    })

    await wrapper.vm.$nextTick()
    const store = useAppStore()
    // If we got here without errors, storage sync initialized successfully
    expect(store.tabs).toBeDefined()
  })
})
