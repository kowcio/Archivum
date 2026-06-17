/**
 * Options App.vue tests.
 *
 * Verifies initial rendering, button states, and interactions.
 * Uses fakeBrowser for storage and messaging — no manual mocks needed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import App from '@/entrypoints/options/App.vue'
import { OptionsPage } from '../../page-objects/OptionsPage'

beforeEach(() => {
  fakeBrowser.reset()
  setActivePinia(createPinia())
})

describe('Options App.vue', () => {
  function createPage() {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: {
          AppTitle: { template: '<div data-testid="app-title">Title</div>' },
          GroupUngroup: { template: '<div data-testid="popup-btn-group-tabs">Group by age</div>' },
          Thresholds: { template: '<div data-testid="thresholds-config">Config</div>' },
          QBtn: { template: '<button><slot /></button>' },
          QBtnGroup: { template: '<div><slot /></div>' },
          QTable: { template: '<div><slot name="body" /></div>' },
          QTr: { template: '<tr><slot /></tr>' },
          QTd: { template: '<td><slot /></td>' },
          QTooltip: { template: '<span><slot /></span>' },
          QInput: { template: '<input :data-testid="$attrs[\'data-testid\'] || \'input\'" />' },
        },
      },
    })
    return { wrapper, page: new OptionsPage(wrapper) }
  }

  it('renders group and ungroup buttons (initial: group visible, ungroup hidden)', async () => {
    const { page } = createPage()
    await flushPromises()
    expect(page.groupBtn.exists()).toBe(true)
    expect(page.ungroupBtn.exists()).toBe(false)
  })

  it('renders thresholds config section', async () => {
    const { page } = createPage()
    await flushPromises()
    expect(page.thresholdsConfig.exists()).toBe(true)
  })

  it('renders app title', async () => {
    const { wrapper } = createPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="app-title"]').exists()).toBe(true)
  })

  it('clicking group toggle sends groupTabsByAge message', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage')
    const { page } = createPage()
    await page.clickGroup()
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalled()
  })
})
