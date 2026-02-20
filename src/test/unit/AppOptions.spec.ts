import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar, QTable, QTd, QTr } from 'quasar'
import type { Tabs } from 'webextension-polyfill'
import App from '@/entrypoints/options/App.vue'
import { createMockTabs } from '@/test/unit/mock/TabServiceMockFactory'
import { useTabStore } from '@/stores/TabStore'

vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: { query: vi.fn(), remove: vi.fn(), update: vi.fn() },
    storage: { local: { set: vi.fn(), get: vi.fn() } }
  }
}))

async function flushPromises() {
  await nextTick()
  await Promise.resolve()
}

describe('Options App', () => {
  let mockTabs: Tabs.Tab[]
  let wrapper: ReturnType<typeof mount>
  let pinia: ReturnType<typeof createPinia>
  let tabStore: ReturnType<typeof useTabStore>

  beforeEach(async () => {
    vi.clearAllMocks()

    pinia = createPinia()
    setActivePinia(pinia)

    mockTabs = createMockTabs(3).map((tab, index) => ({
      ...tab,
      title: `Test Tab ${index + 1}`,
      url: `https://example${index + 1}.com`,
      favIconUrl: `https://example${index + 1}.com/favicon.ico`,
      lastAccessed: Date.now() - (index * 24 * 60 * 60 * 1000),
      openerTabId: index > 0 ? index : undefined
    }))

    // Prevent onMounted from overwriting the store – query returns empty
    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue([])

    wrapper = mount(App, {
      global: {
        plugins: [
          pinia,
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd } }]
        ],
      }
    })

    await flushPromises()

    // Manually populate the store after mount – no browser API needed
    tabStore = useTabStore()
    tabStore.$patch({ tabs: mockTabs, lastSaveDate: null, error: null, loading: false })
    ;(wrapper.vm as any).tabs = mockTabs
    await flushPromises()
  })

  it('renders the tabs table with data-testid selector', async () => {
    const table = wrapper.find('[data-testid="current-tabs-table"]')
    expect(table.exists()).toBe(true)
    expect(table.attributes('data-testid')).toBe('current-tabs-table')
  })

  it('renders rows and cells with data-testid selectors', async () => {
    expect((wrapper.vm as any).rows.length).toBe(3)

    const rows = wrapper.findAll('[data-testid^="row-"]')
    expect(rows.length).toBe(3)

    const firstRow = (wrapper.vm as any).rows[0]
    const firstRowKey = firstRow.rowKey

    const ordinalCell = wrapper.find(`[data-testid="cell-ordinal-${firstRowKey}"]`)
    expect(ordinalCell.exists()).toBe(true)
    expect(ordinalCell.text()).toBe('1')

    const urlCell = wrapper.find(`[data-testid="cell-url-${firstRowKey}"] a`)
    expect(urlCell.exists()).toBe(true)
    expect(urlCell.attributes('href')).toBe('https://example1.com')

    const ageCell = wrapper.find(`[data-testid="cell-lastAccess-${firstRowKey}"]`)
    expect(ageCell.exists()).toBe(true)
    expect(ageCell.text()).not.toBe('—')
    expect(ageCell.classes().some(cls => cls.startsWith('bg-'))).toBe(true)

    const ageLabelCell = wrapper.find(`[data-testid="cell-lastAccessAge-${firstRowKey}"]`)
    expect(ageLabelCell.exists()).toBe(true)
    expect(ageLabelCell.text()).toMatch(/\d+d|—/)
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

    expect(tabStore.tabs).toEqual(snapshot!.tabs)
    expect(tabStore.lastSaveDate).toBe(snapshot!.savedAt)
  })
})
