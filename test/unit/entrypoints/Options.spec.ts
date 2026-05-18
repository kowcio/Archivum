import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput } from 'quasar'
import { setActivePinia, createPinia } from 'pinia'
import { useTabStore } from 'src/stores/TabStore'
import type { Tabs } from 'webextension-polyfill'
import OptionsApp from 'src/entrypoints/options/App.vue'
import tabsData from '../../mocks/tabs_example.json'
import { nextTick } from 'vue'

// Mock browser API
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      remove: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
    },
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
    },
    scripting: {
      executeScript: vi.fn(),
    },
  },
}))

async function flushPromises() {
  await nextTick()
  await Promise.resolve()
}

describe('Options Entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('should mount the options component', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        plugins: [
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput } }]
        ],
        stubs: {
          teleport: true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('should render options container with correct ID', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        plugins: [
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput } }]
        ],
        stubs: {
          teleport: true,
        },
      },
    })

    const optionsContainer = wrapper.find('#options')
    expect(optionsContainer.exists()).toBe(true)
    expect(optionsContainer.element.id).toBe('options')
  })

  it('should render version info', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        plugins: [
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput } }]
        ],
        stubs: {
          teleport: true,
        },
      },
    })

    const versionInfo = wrapper.find('.version-info')
    expect(versionInfo.exists()).toBe(true)
    expect(versionInfo.text()).toContain('Version:')
  })

   it('should render button group container', () => {
     const wrapper = mount(OptionsApp, {
       global: {
         plugins: [
           [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput } }]
         ],
         stubs: {
           teleport: true,
         },
       },
     })

     const btnGroup = wrapper.find('.button-group-container')
     expect(btnGroup.exists()).toBe(true)
   })

  it('should have proper HTML structure with row layout', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        plugins: [
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput } }]
        ],
        stubs: {
          teleport: true,
        },
      },
    })

    const optionsDiv = wrapper.find('#options')
    expect(optionsDiv.exists()).toBe(true)
    expect(optionsDiv.classes()).toContain('row')
  })

  it('should load tabs from store when btn-load-tabs button is clicked', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const wrapper = mount(OptionsApp, {
      global: {
        plugins: [
          pinia,
          [Quasar, { config: { dark: false }, components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput } }]
        ],
        stubs: {
          teleport: true,
        },
      },
    })

    const tabStore = useTabStore()

    // Mock the getAllOpenedTabs method to set the tabs data
    tabStore.getAllOpenedTabs = vi.fn(async () => {
      tabStore.$patch({ tabs: (tabsData as any).tabs as Tabs.Tab[] })
    })

    // Wait for component to render
    await flushPromises()

    // Click the Load Tabs button by finding it directly using data-testid
    const loadTabsButton = wrapper.find('[data-testid="btn-load-tabs"]')
    expect(loadTabsButton.exists()).toBe(true)

    await loadTabsButton.trigger('click')
    await flushPromises()

    // Verify that getAllOpenedTabs was called
    expect(tabStore.getAllOpenedTabs).toHaveBeenCalled()

    // Verify that tabs are loaded in the store
    expect(tabStore.tabs.length).toEqual(20)
    expect(tabStore.tabs[0].url).toBeDefined()
    expect(tabStore.tabs[0].title).toBeDefined()
  })
})
