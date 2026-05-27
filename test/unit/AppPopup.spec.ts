import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { Quasar, QBtn } from 'quasar'
import AppPopup from 'src/entrypoints/popup/App.vue'

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

describe('Popup App', () => {
  const createWrapper = () =>
    mount(AppPopup, {
      global: {
        plugins: [
          createTestingPinia(),
          [Quasar, { components: { QBtn } }],
        ],
        stubs: { teleport: true },
      },
    })

  it('should mount and display the component', () => {
    const wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.app-options-wrapper').exists()).toBe(true)
  })

  it('should render the "No tabs loaded yet." caption', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('No tabs loaded yet.')
  })

  it('should render action buttons', () => {
    const wrapper = createWrapper()
    expect(wrapper.findAll('.q-btn').length).toBeGreaterThan(0)
  })
})
