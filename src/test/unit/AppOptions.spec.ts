import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { Quasar, QTable, QTd, QTr } from 'quasar'
import type { Tabs } from 'webextension-polyfill'
import App from '@/entrypoints/options/App.vue'
import { createMockTabs } from '@/test/unit/mock/TabServiceMockFactory'

// Mock browser APIs to control the tabsApi.query method
vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: vi.fn(),
      remove: vi.fn(),
      update: vi.fn()
    },
    storage: {
      local: {
        set: vi.fn(),
        get: vi.fn()
      }
    }
  }
}))

async function flushPromises() {
  await nextTick()
  await Promise.resolve()
}

describe('Options App', () => {
  let mockTabs: Tabs.Tab[]
  let wrapper: ReturnType<typeof mount>

  beforeEach(async () => {
    vi.clearAllMocks()

    mockTabs = createMockTabs(3).map((tab, index) => ({
      ...tab,
      title: `Test Tab ${index + 1}`,
      url: `https://example${index + 1}.com`,
      favIconUrl: `https://example${index + 1}.com/favicon.ico`,
      lastAccessed: Date.now() - (index * 24 * 60 * 60 * 1000),
      openerTabId: index > 0 ? index : undefined
    }))

    const { default: browser } = await import('webextension-polyfill')
    vi.mocked(browser.tabs.query).mockResolvedValue(mockTabs)

    wrapper = mount(App, {
      global: {
        plugins: [
          createPinia(),
          [Quasar, {
            config: { dark: false },
            components: { QTable, QTr, QTd },
          }]
        ],
      }
    })

    await flushPromises()
  })

  it('renders the tabs table with data-testid selector', async () => {
    const table = wrapper.find('[data-testid="current-tabs-table"]')
    expect(table.exists()).toBe(true)
    expect(table.attributes('data-testid')).toBe('current-tabs-table')
  })

  it('renders rows and cells with data-testid selectors', async () => {
    ;(wrapper.vm as any).tabs = mockTabs
    await flushPromises()

    expect((wrapper.vm as any).rows.length).toBe(3)

    const table = wrapper.find('[data-testid="current-tabs-table"]')
    expect(table.exists()).toBe(true)

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
    expect(ageCell.text()).toMatch(/\d+d \d+h|—/)
    expect(ageCell.classes().some(cls => cls.startsWith('bg-'))).toBe(true)

    const ageLabelCell = wrapper.find(`[data-testid="cell-lastAccessAge-${firstRowKey}"]`)
    expect(ageLabelCell.exists()).toBe(true)
    expect(ageLabelCell.text()).toMatch(/\d+d|—/)
    expect(ageLabelCell.text()).toMatch(/\d+d \d+h|—/)
  })
})
