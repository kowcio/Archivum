import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppPopup from '@/AppPopup.vue'

describe('AppPopup', () => {
  it('should mount and display the component', () => {
    const wrapper = mount(AppPopup)

    // Assert that the component is mounted
    expect(wrapper.exists()).toBe(true)

    // Assert that the component displays the expected content
    expect(wrapper.text()).toContain('Popup Mounted!')
  })
})
