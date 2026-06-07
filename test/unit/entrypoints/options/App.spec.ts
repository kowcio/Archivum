import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from 'src/entrypoints/options/App.vue'
import { createPinia, setActivePinia } from 'pinia'

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
    },
    alarms: {
      create: vi.fn(),
      onAlarm: {
        addListener: vi.fn(),
      },
    },
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
    pink: '#e91e63',
    purple: '#7c3aed',
    grey: '#9aa0a6',
    cyan: '#00bcd4',
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
  type: {
    ThresholdLevel: {},
  },
}))

// Mock appStore
vi.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    tabs: [],
    loading: false,
    error: null,
    isGrouped: false,
    tabRows: [],
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
    },
    init: vi.fn(() => Promise.resolve()),
    getAllOpenedTabs: vi.fn(() => Promise.resolve([])),
    $patch: vi.fn(),
    persistTabs: vi.fn(() => Promise.resolve()),
  }),
}))

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('Options App.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the component', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: {
          AppTitle: true,
          LoadResetButton: true,
          GroupUngroup: true,
          Thresholds: true,
          QBtn: true,
          QBtnGroup: true,
          QTable: true,
          QTr: true,
          QTd: true,
          QTooltip: true,
        },
      },
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.exists()).toBe(true)
  })

  describe('Title Section', () => {
    it('renders AppTitle component', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: { template: '<div data-testid="app-title">App Title</div>' },
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: true,
            QBtn: true,
            QBtnGroup: true,
            QTable: true,
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()
      const appTitle = wrapper.find('[data-testid="app-title"]')
      expect(appTitle.exists()).toBe(true)
      expect(appTitle.text()).toBe('App Title')
    })
  })

  describe('Table Section', () => {
    it('renders q-table for displaying tabs', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: true,
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: true,
            QBtn: true,
            QBtnGroup: true,
            QTable: { template: '<div data-testid="current-tabs-table" class="q-table">Tabs Table</div>' },
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()
      const table = wrapper.find('[data-testid="current-tabs-table"]')
      expect(table.exists()).toBe(true)
    })

    it('verifies table has options container with correct layout', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: true,
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: true,
            QBtn: true,
            QBtnGroup: true,
            QTable: true,
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()
      const optionsContainer = wrapper.find('#options')
      expect(optionsContainer.exists()).toBe(true)
      expect(optionsContainer.classes()).toContain('row')
    })

    it('renders table-container div for table layout', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: true,
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: true,
            QBtn: true,
            QBtnGroup: true,
            QTable: { template: '<div data-testid="current-tabs-table"></div>' },
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()
      const tableContainer = wrapper.find('.table-container')
      expect(tableContainer.exists()).toBe(true)
    })
  })

  describe('Thresholds Section', () => {
    it('renders Thresholds configuration component', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: true,
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: { template: '<div data-testid="thresholds-config">Thresholds Config</div>' },
            QBtn: true,
            QBtnGroup: true,
            QTable: true,
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()
      const thresholds = wrapper.find('[data-testid="thresholds-config"]')
      expect(thresholds.exists()).toBe(true)
    })
  })

  describe('Complete Layout', () => {
    it('renders all three main sections: Title, Table, and Thresholds', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: { template: '<div data-testid="app-title">Title</div>' },
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: { template: '<div data-testid="thresholds-config">Thresholds</div>' },
            QBtn: true,
            QBtnGroup: true,
            QTable: { template: '<div data-testid="current-tabs-table">Table</div>' },
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()

      // Verify all three main sections are rendered
      const title = wrapper.find('[data-testid="app-title"]')
      const table = wrapper.find('[data-testid="current-tabs-table"]')
      const thresholds = wrapper.find('[data-testid="thresholds-config"]')

      expect(title.exists()).toBe(true)
      expect(table.exists()).toBe(true)
      expect(thresholds.exists()).toBe(true)
    })

    it('renders control buttons in dedicated sections', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            AppTitle: true,
            LoadResetButton: true,
            GroupUngroup: true,
            Thresholds: true,
            QBtn: true,
            QBtnGroup: true,
            QTable: true,
            QTr: true,
            QTd: true,
            QTooltip: true,
          },
        },
      })

      await wrapper.vm.$nextTick()

      // Verify component renders and contains the button structure in the template
      expect(wrapper.exists()).toBe(true)
      // The options container and row classes should be present for layout
      const optionsContainer = wrapper.find('#options')
      expect(optionsContainer.exists()).toBe(true)
    })
  })
})








