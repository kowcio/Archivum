import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip } from 'quasar'
import type { Tabs } from 'webextension-polyfill'
import App from 'src/entrypoints/options/App.vue'
import { createMockTabs } from './mock/TabServiceMockFactory'
import { useTabStore } from 'src/stores/TabStore'
import { useGlobalStore } from 'src/stores/globalStore'
import { TabDots } from 'src/services/TabDots'
import tabsExampleData from '../mocks/tabs_example.json'

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: { query: vi.fn(), remove: vi.fn(), update: vi.fn(), onActivated: { addListener: vi.fn(), removeListener: vi.fn() } },
    storage: { local: { set: vi.fn(), get: vi.fn() } },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn() },
    scripting: { executeScript: vi.fn() },
  }
}))

describe('Options App', () => {
  let mockTabs: Tabs.Tab[]
  let wrapper: ReturnType<typeof mount>
  let pinia: ReturnType<typeof createPinia>
  let tabStore: ReturnType<typeof useTabStore>
  let resetTabTitlesSpy: MockInstance

  beforeEach(async () => {
    vi.clearAllMocks()

    pinia = createPinia()
    setActivePinia(pinia)

    // Initialize the store first so we can spy on it
    tabStore = useTabStore()
    resetTabTitlesSpy = vi.spyOn(tabStore, 'reset').mockResolvedValue()
    // Prevent favicon polling from interfering with test assertions
    vi.spyOn(tabStore, 'waitForFaviconsLoaded').mockResolvedValue()
    // Prevent real network calls in markTabWithLBracket (avoids race condition)
    vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue(null)
    // Prevent OffscreenCanvas errors (not available in jsdom) and avoid status-check polling loops
    vi.spyOn(TabDots, 'renderLBracketDataUrl').mockResolvedValue('data:image/png;base64,MOCK')

    // Create tabs that are old enough to be marked (10+ days old)
    // status: 'complete' is required to skip the tab-status polling loop in markTabWithLBracket
    mockTabs = createMockTabs(3).map((tab, index) => ({
      ...tab,
      status: 'complete' as const,
      title: `Test Tab ${index + 1}`,
      url: `https://example${index + 1}.com`,
      favIconUrl: `https://example${index + 1}.com/favicon.ico`,
      lastAccessed: Date.now() - ((10 + index) * 24 * 60 * 60 * 1000), // 10, 11, 12 days old
      openerTabId: index > 0 ? index : undefined
    }))

    // Mock the browser.tabs.query to return our mock tabs
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue(mockTabs)
    vi.mocked(browser.scripting.executeScript).mockResolvedValue(undefined as any)

    wrapper = mount(App, {
      global: {
        plugins: [
          pinia,
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip } }]
        ],
      }
    })

    // Use VTU flushPromises — recursively flushes ALL pending async chains
    await flushPromises()

    // Store is already initialized, just log for debugging
    console.log('Store tabs after mount:', tabStore.tabs.length)
    console.log('Store tabs:', tabStore.tabs.map((t: any) => ({ title: t.title, url: t.url })))

    // Force the component to update its computed rows
    await flushPromises()
  })

  it('reset button triggers reset call', async () => {
    const resetButton = wrapper.find('[data-testid="btn-reset"]')
    expect(resetButton.exists()).toBe(true)

    await resetButton.trigger('click')

    expect(resetTabTitlesSpy).toHaveBeenCalledTimes(1)
  })

  it('renders the tabs table with data-testid selector', async () => {
    const table = wrapper.find('[data-testid="current-tabs-table"]')
    expect(table.exists()).toBe(true)
    expect(table.attributes('data-testid')).toBe('current-tabs-table')
  })

  it('renders rows and cells with data-testid selectors', async () => {
    // Wait for the component to update after setting tabs
    await flushPromises()


    // Check the store has tabs
    const store = useTabStore()
    console.log('Store tabs length:', store.tabs.length)
    console.log('Store tabs:', store.tabs.map((t: any) => ({ title: t.title, url: t.url })))

    // Store should have 3 tabs from mock
    expect(store.tabs.length).toBe(3)

    // Check the component rows computed property (tabRows is from storeToRefs in the component)
    const rows = (wrapper.vm as any).tabRows
    console.log('Rows length:', rows.length)
    console.log('Rows:', rows.map((r: any) => ({ ordinal: r.ordinal, title: r.title })))

    // Rows should also have 3 items
    expect(rows.length).toBe(3)

    // Verify row structure
    expect(rows[0]).toHaveProperty('ordinal', 1)
    expect(rows[0]).toHaveProperty('title')
    expect(rows[0]).toHaveProperty('url')
  })

  it('gen & save mock tabs button: store contains generated tabs and loadTabsHistory restores them', async () => {
    // In-memory storage passed directly to store actions – no browser API mocking needed
    const storageData: Record<string, unknown> = {}
    const inMemoryStorage = {
      set: async (items: Record<string, unknown>) => { Object.assign(storageData, items) },
      get: async (key: string) => ({ [key]: storageData[key] }),
    } as unknown as Parameters<typeof tabStore.saveAllTabs>[0]

    // Populate the store with generated mock tabs and save using the in-memory storage
    tabStore.$patch({ tabs: createMockTabs(5) })
    const snapshot = await tabStore.saveAllTabs(inMemoryStorage)

    expect(snapshot).toBeDefined()
    expect(snapshot!.tabs).toHaveLength(5)
    expect(tabStore.lastSaveDate).not.toBeNull()

    // Reset store to simulate a fresh session
    tabStore.$patch({ tabs: [], lastSaveDate: null })
    expect(tabStore.tabs).toHaveLength(0)

    // Load from in-memory storage – should restore the exact same tabs
    await tabStore.loadTabsHistory(inMemoryStorage)

    expect(tabStore.tabs).toMatchObject(snapshot!.tabs)
    expect(tabStore.lastSaveDate).toBe(snapshot!.savedAt)
  })

  it('clicking btn-load-tabs button loads tabs from mock data and renders in table', async () => {
    // Clear store and mock to start fresh
    vi.clearAllMocks()
    tabStore.$patch({ tabs: [] })

    // Re-setup mocks cleared by clearAllMocks
    vi.spyOn(tabStore, 'waitForFaviconsLoaded').mockResolvedValue()
    vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue(null)
    vi.spyOn(TabDots, 'renderLBracketDataUrl').mockResolvedValue('data:image/png;base64,MOCK')

    // Initialize global store (needed for component initialization)
    const globalStore = useGlobalStore()
    globalStore.$patch({
      version: '1.0.0',
    })

     // Mock browser.tabs.query with real tabs_example.json data - using any query params
     const { default: browser } = await import('webextension-polyfill')
     vi.mocked(browser.tabs.query).mockResolvedValue(tabsExampleData.tabs as any)
     vi.mocked(browser.scripting.executeScript).mockResolvedValue(undefined as any)

    // Find and click the "Load Tabs" button
    const loadTabsButton = wrapper.find('[data-testid="btn-load-tabs"]')
    expect(loadTabsButton.exists()).toBe(true)

    await loadTabsButton.trigger('click')
    await flushPromises()

     // Verify store has loaded all tabs from the mock data
     console.log('Store tabs length after click:', tabStore.tabs.length)
     expect(tabStore.tabs.length).toBe(20)

    // Verify store tabs have correct structure from mock data
    expect(tabStore.tabs[0]).toHaveProperty('id')
    expect(tabStore.tabs[0]).toHaveProperty('title')
    expect(tabStore.tabs[0]).toHaveProperty('url')
    expect(tabStore.tabs[0].id).toBe(76)
    expect(tabStore.tabs[0].title).toContain('NAKLEJKI')

    // Verify table component exists and is rendered
    const table = wrapper.find('[data-testid="current-tabs-table"]')
    expect(table.exists()).toBe(true)

    // Wrapper should contain the table HTML
    expect(wrapper.html()).toContain('current-tabs-table')
  })
})
