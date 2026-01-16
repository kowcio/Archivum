import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import App from '@/App.vue'

describe('HelloWorld', () => {
  it('renders properly', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia()]
      }
    })
    expect(wrapper.text()).toContain('Hello VUE 33')
  })
})
