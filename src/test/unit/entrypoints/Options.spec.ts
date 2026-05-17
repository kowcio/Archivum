import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OptionsApp from '@/entrypoints/options/App.vue'
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
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      remove: vi.fn(() => Promise.resolve()),
    },
  },
}))

// Mock Quasar components
vi.mock('quasar', () => ({
  QBtn: { name: 'q-btn', template: '<button><slot></slot></button>' },
  QBtnGroup: { name: 'q-btn-group', template: '<div><slot></slot></div>' },
  QTable: { name: 'q-table', template: '<table><slot></slot></table>' },
  QTr: { name: 'q-tr', template: '<tr><slot></slot></tr>' },
  QTd: { name: 'q-td', template: '<td><slot></slot></td>' },
  QInput: { name: 'q-input', template: '<input />' },
}), { virtual: true })

describe('Options Entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('should mount the options component', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        stubs: {
          'q-btn': true,
          'q-btn-group': true,
          'q-table': true,
          'q-tr': true,
          'q-td': true,
          'q-input': true,
          teleport: true,
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('should render options container with correct ID', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        stubs: {
          'q-btn': true,
          'q-btn-group': true,
          'q-table': true,
          'q-tr': true,
          'q-td': true,
          'q-input': true,
          teleport: true,
        },
      },
    })

    const optionsContainer = wrapper.find('#options')
    expect(optionsContainer.exists()).toBe(true)
    expect(optionsContainer.element.id).toBe('options')
  })

  it('should render version info', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        stubs: {
          'q-btn': true,
          'q-btn-group': true,
          'q-table': true,
          'q-tr': true,
          'q-td': true,
          'q-input': true,
          teleport: true,
        },
      },
    })

    const versionInfo = wrapper.find('.version-info')
    expect(versionInfo.exists()).toBe(true)
    expect(versionInfo.text()).toContain('Version:')
  })

  it('should render button group container', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        stubs: {
          'q-btn': true,
          'q-btn-group': true,
          'q-table': true,
          'q-tr': true,
          'q-td': true,
          'q-input': true,
          teleport: true,
        },
      },
    })

    const btnGroup = wrapper.find('.q-col-gutter')
    expect(btnGroup.exists()).toBe(true)
  })

  it('should have proper HTML structure with row layout', () => {
    const wrapper = mount(OptionsApp, {
      global: {
        stubs: {
          'q-btn': true,
          'q-btn-group': true,
          'q-table': true,
          'q-tr': true,
          'q-td': true,
          'q-input': true,
          teleport: true,
        },
      },
    })

    const optionsDiv = wrapper.find('#options')
    expect(optionsDiv.exists()).toBe(true)
    expect(optionsDiv.classes()).toContain('row')
  })
})

