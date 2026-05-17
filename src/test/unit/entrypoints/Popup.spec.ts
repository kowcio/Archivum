import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PopupApp from '@/entrypoints/popup/App.vue'

// Mock browser API
vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve({})),
    },
    runtime: {
      openOptionsPage: vi.fn(() => Promise.resolve()),
      getURL: vi.fn((path: string) => `chrome-extension://id/${path}`),
    },
  },
}))

describe('Popup Entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should mount the popup component', () => {
    const wrapper = mount(PopupApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('should render tab-list container with correct ID', () => {
    const wrapper = mount(PopupApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const tabListElement = wrapper.find('#tab-list')
    expect(tabListElement.exists()).toBe(true)
    expect(tabListElement.element.id).toBe('tab-list')
  })

  it('should render popup heading', () => {
    const wrapper = mount(PopupApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const heading = wrapper.find('h1')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toContain('Popup Mounted!')
  })

  it('should render action buttons', () => {
    const wrapper = mount(PopupApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const buttons = wrapper.findAll('button.button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('should render tab list container', () => {
    const wrapper = mount(PopupApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    const tabListContainer = wrapper.find('ul.tab-list')
    expect(tabListContainer.exists()).toBe(true)
  })
})

