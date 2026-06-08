import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from 'src/entrypoints/popup/App.vue'

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(async () => ({ groupsCreated: 1, error: null })),
      openOptionsPage: vi.fn(async () => undefined),
      getURL: vi.fn(() => 'options.html'),
    },
    tabs: {
      create: vi.fn(async () => ({ id: 1 })),
    },
  },
}))

/**
 * QBtn stub that renders a real <button> with the label text.
 * Needed because the popup uses q-btn without setting up Quasar plugin in tests.
 */
const QBtnStub = { template: '<button :data-testid="`btn-${label}`">{{ label }}</button>', props: ['label'] }

describe('Popup App.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the popup component', () => {
    const wrapper = mount(App, {
      global: { stubs: { AppTitle: true, QBtn: QBtnStub } },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('sends groupTabsByAge message on Group button click', async () => {
    const wrapper = mount(App, {
      global: { stubs: { AppTitle: true, QBtn: QBtnStub } },
    })
    const btn = wrapper.find('[data-testid="btn-Group tabs"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    const { browser } = await import('wxt/browser')
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'groupTabsByAge' })
  })

  it('sends ungroupAllTabs message on Ungroup button click', async () => {
    const wrapper = mount(App, {
      global: { stubs: { AppTitle: true, QBtn: QBtnStub } },
    })
    const btn = wrapper.find('[data-testid="btn-Ungroup"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    const { browser } = await import('wxt/browser')
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'ungroupAllTabs' })
  })
})
