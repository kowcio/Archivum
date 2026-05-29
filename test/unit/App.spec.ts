import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from 'src/entrypoints/content/App.vue'
import {createPinia} from "pinia";

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: vi.fn() }
    }
  }
}))

describe('Content App', () => {
  it('renders properly', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()]
      }
    })
    expect(wrapper.text()).toContain('Hello from App.vue')
  })

  it('renders content root with expected id', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()]
      }
    })
    const root = wrapper.find('[data-testid="content-root"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('id')).toBe('my-vue-header')
  })

  it('renders debug element with expected text', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()]
      }
    })
    const debug = wrapper.find('[data-testid="debug"]')
    expect(debug.exists()).toBe(true)
    expect(debug.text()).toBe('Hello from App.vue')
  })
})
