import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/entrypoints/content/App.vue'
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
})
