import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar, QBtn } from 'quasar'
import { createPinia } from 'pinia'
import PopupApp from 'src/entrypoints/popup/App.vue'

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
    storage: {
      local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
    },
  },
}))

describe('Popup Entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createWrapper = () =>
    mount(PopupApp, {
      global: {
        plugins: [
          createPinia(),
          [Quasar, { components: { QBtn } }],
        ],
        stubs: { teleport: true },
      },
    })

  it('should mount the popup component', () => {
    const wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
  })

  it('should render the app wrapper container', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.app-options-wrapper').exists()).toBe(true)
  })

  it('should render the no-tabs caption', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('No tabs loaded yet.')
  })

  it('should render action buttons (q-btn)', () => {
    const wrapper = createWrapper()
    expect(wrapper.findAll('.q-btn').length).toBeGreaterThan(0)
  })

  it('should render the square buttons grid', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.square-grid').exists()).toBe(true)
  })
})

