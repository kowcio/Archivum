/**
 * Content App.vue tests.
 *
 * Content script is a simple Vue component with a debug message.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import App from '@/entrypoints/content/App.vue'
import { ContentPage } from '../../page-objects/ContentPage'

describe('Content App.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders content-root with data-testid', () => {
    const wrapper = mount(App)
    const page = new ContentPage(wrapper)
    expect(page.root.exists()).toBe(true)
  })

  it('displays debug message', () => {
    const wrapper = mount(App)
    const page = new ContentPage(wrapper)
    expect(page.debug.exists()).toBe(true)
    expect(page.debug.text()).toBe('Hello from App.vue')
  })
})
