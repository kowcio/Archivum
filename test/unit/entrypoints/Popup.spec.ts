import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PopupApp from 'src/entrypoints/popup/App.vue'
import { createPinia } from 'pinia'

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

  const createWrapper = () => {
    return mount(PopupApp, {
      global: {
        plugins: [createPinia()],
        stubs: {
          teleport: true,
        },
      },
    })
  }

  it('should mount the popup component', () => {
    const wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
  })

  it('should render tab-list container with correct ID', () => {
    const wrapper = createWrapper()
    const tabListElement = wrapper.find('#tab-list')
    expect(tabListElement.exists()).toBe(true)
    expect(tabListElement.element.id).toBe('tab-list')
  })

  it('should render popup heading', () => {
    const wrapper = createWrapper()
    const heading = wrapper.find('h1')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toContain('Popup Mounted!')
  })

  it('should render action buttons', () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('button.button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('should render tab list container', () => {
    const wrapper = createWrapper()
    const tabListContainer = wrapper.find('ul.tab-list')
    expect(tabListContainer.exists()).toBe(true)
  })
})

