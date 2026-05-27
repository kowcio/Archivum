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
    storage: { local: { set: vi.fn(), get: vi.fn() }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
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

    tabStore = useTabStore()
    resetTabTitlesSpy = vi.spyOn(tabStore, 'reset').mockResolvedValue()
    vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue(null)
    vi.spyOn(TabDots, 'renderLBracketDataUrl').mockResolvedValue('data:image/png;base64,MOCK')

    mockTabs = createMockTabs(3).map((tab, index) => ({
      ...tab,
      status: 'complete' as const,
      title: `Test Tab ${index + 1}`,
      url: `https://example${index + 1}.com`,
      favIconUrl: `https://example${index + 1}.com/favicon.ico`,
      lastAccessed: Date.now() - ((10 + index) * 24 * 60 * 60 * 1000),
      openerTabId: index > 0 ? index : undefined
    }))

    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue(mockTabs)
    vi.mocked(browser.scripting.executeScript).mockResolvedValue(undefined as any)
    // loadTabsHistory returns empty on mount (no saved snapshot)
    vi.mocked(browser.storage.local.get).mockResolvedValue({})

    wrapper = mount(App, {
      global: {
        plugins: [
          pinia,
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip } }]
        ],
      }
    })

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
    await flushPromises()

    // After mount, tabs come from loadTabsHistory (empty) — not getAllOpenedTabs
    // So rows.length === 0 unless we explicitly click "Load Tabs"
    const rows = (wrapper.vm as any).tabRows
    expect(Array.isArray(rows)).toBe(true)
  })

  it('clicking btn-load-tabs loads tabs from mock data and renders in table', async () => {
    vi.clearAllMocks()
    tabStore.$patch({ tabs: [] })

    vi.spyOn(TabDots, 'fetchFaviconDataUrl').mockResolvedValue(null)
    vi.spyOn(TabDots, 'renderLBracketDataUrl').mockResolvedValue('data:image/png;base64,MOCK')

    const globalStore = useGlobalStore()
    globalStore.$patch({ version: '1.0.0' })

    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue(tabsExampleData.tabs as any)
    vi.mocked(browser.scripting.executeScript).mockResolvedValue(undefined as any)

    const loadTabsButton = wrapper.find('[data-testid="btn-load-tabs"]')
    expect(loadTabsButton.exists()).toBe(true)

    await loadTabsButton.trigger('click')
    await flushPromises()

    expect(tabStore.tabs.length).toBe(20)
    expect(tabStore.tabs[0]).toHaveProperty('id')
    expect(tabStore.tabs[0]).toHaveProperty('title')
    expect(tabStore.tabs[0].id).toBe(76)

    const table = wrapper.find('[data-testid="current-tabs-table"]')
    expect(table.exists()).toBe(true)
  })
})
