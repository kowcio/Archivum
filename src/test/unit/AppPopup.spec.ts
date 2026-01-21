import { describe, it, expect, vi } from 'vitest'
vi.mock('webextension-polyfill', () => ({
  default: {}
}))
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import AppPopup from '@/AppPopup.vue'

describe('AppPopup', () => {
  it('should mount and display the component', () => {
    const wrapper = mount(AppPopup, {
      global: {
        plugins: [createTestingPinia()]
      }
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('Popup Mounted!')
  })
})
