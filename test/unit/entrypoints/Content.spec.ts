import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ContentApp from 'src/entrypoints/content/App.vue'
import { setActivePinia, createPinia } from 'pinia'
// Mock browser API
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
    },
  },
}))
describe('Content Entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })
  it('should mount the content component', () => {
    const wrapper = mount(ContentApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
  it('should render content-root container with correct ID', () => {
    const wrapper = mount(ContentApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
    const contentRoot = wrapper.find('#my-vue-header')
    expect(contentRoot.exists()).toBe(true)
    expect(contentRoot.element.id).toBe('my-vue-header')
  })
  it('should have data-testid attribute on root container', () => {
    const wrapper = mount(ContentApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
    const contentRoot = wrapper.find('[data-testid="content-root"]')
    expect(contentRoot.exists()).toBe(true)
  })
  it('should render debug element with testid', () => {
    const wrapper = mount(ContentApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
    const debugElement = wrapper.find('[data-testid="debug"]')
    expect(debugElement.exists()).toBe(true)
    expect(debugElement.text()).toContain('Hello from App.vue')
  })
  it('should have proper HTML structure', () => {
    const wrapper = mount(ContentApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
    const root = wrapper.find('#my-vue-header')
    expect(root.exists()).toBe(true)
    expect(root.find('[data-testid="debug"]').exists()).toBe(true)
  })

  it('should render the expected debug copy exactly', () => {
    const wrapper = mount(ContentApp, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    })
    const debugElement = wrapper.find('[data-testid="debug"]')
    expect(debugElement.text()).toBe('Hello from App.vue')
  })
})
