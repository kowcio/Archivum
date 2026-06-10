import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from 'src/entrypoints/options/App.vue'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(async (_msg: any) => {
        // getTabs returns tabs with overrides applied
        return {
          error: null,
          tabs: [
            { id: 1, url: 'https://example.com', title: 'Example', favIconUrl: '', lastAccessed: Date.now() - 86400000 * 10 },
            { id: 2, url: 'https://test.org', title: 'Test', favIconUrl: '', lastAccessed: Date.now() - 86400000 * 3 },
          ],
        }
      }),
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      get: vi.fn(() => Promise.resolve({ id: 1, url: 'http://example.com' })),
      remove: vi.fn(() => Promise.resolve()),
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}))

vi.mock('@/constants', () => ({
  APP_CONSTANTS: {
    APP_NAME: 'Tab Age Tracker',
    APP_ID: 'TabAgeTracker',
    STORE_GLOBAL_STORE: 'global_store',
    APP_VERSION: '1.0.0-20240101-00:00',
  },
  THEME_COLORS: {
    green: '#188038', blue: '#1f73e7', yellow: '#f9ab00', red: '#d33b27',
    pink: '#e91e63', purple: '#7c3aed', grey: '#9aa0a6', cyan: '#00bcd4',
  },
  APP_DEFAULTS: {
    THRESHOLDS: {
      activeLevels: 3,
      presets: [
        { key: 'DAYS', label: 'Days', days: 7, color: 'green' },
        { key: 'WEEK', label: 'Week', days: 14, color: 'blue' },
        { key: 'WEEKS_2', label: '2 Week', days: 21, color: 'yellow' },
        { key: 'MONTH', label: 'Month', days: 30, color: 'red' },
        { key: 'QUARTERS', label: 'Quarter', days: 90, color: 'pink' },
        { key: 'YEARS', label: 'Year', days: 365, color: 'purple' },
        { key: 'ANCIENT', label: 'Are You kidding me ?', days: 3650, color: 'grey' },
      ],
    },
  },
}))

vi.mock('@/stores/configStore', () => ({
  useConfigStore: () => ({
    thresholds: {
      levels: [
        { key: 'DAYS', label: 'Days', days: 7, color: 'green' },
        { key: 'WEEK', label: 'Week', days: 14, color: 'blue' },
        { key: 'WEEKS_2', label: '2 Week', days: 21, color: 'yellow' },
      ],
      activeLevels: 3,
      active: () => [
        { key: 'DAYS', label: 'Days', days: 7, color: 'green' },
        { key: 'WEEK', label: 'Week', days: 14, color: 'blue' },
        { key: 'WEEKS_2', label: '2 Week', days: 21, color: 'yellow' },
      ],
      toBoundaries: () => [7, 14, 21],
      toJSON: () => ({ levels: [], activeLevels: 3 }),
      merge: () => ({ levels: [], activeLevels: 3, isValid: () => true, toBoundaries: () => [7, 14, 21] }),
    },
    loading: false,
    error: null,
    configLastUpdated: 0,
    load: vi.fn(() => Promise.resolve()),
    save: vi.fn(() => Promise.resolve()),
    watch: vi.fn(),
    setThresholds: vi.fn(() => Promise.resolve()),
    setActiveLevels: vi.fn(() => Promise.resolve()),
    resetToDefaults: vi.fn(() => Promise.resolve()),
  }),
}))

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Options App.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the component', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { AppTitle: true, GroupUngroup: true, Thresholds: true, QBtn: true, QBtnGroup: true, QTable: true, QTr: true, QTd: true, QTooltip: true },
      },
    })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })

  it('renders AppTitle', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { AppTitle: { template: '<div data-testid="app-title">Title</div>' }, GroupUngroup: true, Thresholds: true, QBtn: true, QBtnGroup: true, QTable: true, QTr: true, QTd: true, QTooltip: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="app-title"]').exists()).toBe(true)
  })

  it('renders q-table when tabs are loaded', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { AppTitle: true, GroupUngroup: true, Thresholds: true, QBtn: true, QBtnGroup: true, QTable: { template: '<div data-testid="current-tabs-table">Table</div>' }, QTr: true, QTd: true, QTooltip: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="current-tabs-table"]').exists()).toBe(true)
  })

  it('renders Thresholds component', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { AppTitle: true, GroupUngroup: true, Thresholds: { template: '<div data-testid="thresholds-config">Config</div>' }, QBtn: true, QBtnGroup: true, QTable: true, QTr: true, QTd: true, QTooltip: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="thresholds-config"]').exists()).toBe(true)
  })

  it('has #options container', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { AppTitle: true, GroupUngroup: true, Thresholds: true, QBtn: true, QBtnGroup: true, QTable: true, QTr: true, QTd: true, QTooltip: true },
      },
    })
    await flushPromises()
    expect(wrapper.find('#options').exists()).toBe(true)
  })
})
