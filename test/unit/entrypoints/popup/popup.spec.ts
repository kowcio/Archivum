/**
 * Popup App.vue tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BACKGROUND_MESSAGE_ACTIONS } from '@/constants'
import App from '@/entrypoints/popup/App.vue'
beforeEach(() => { fakeBrowser.reset() })
const QBtnStub = {
  template: '<button :data-testid="`btn-${$attrs.label}`" @click="$attrs.onClick && $attrs.onClick()"><slot /></button>',
  inheritAttrs: false,
}
describe('Popup App.vue', () => {
  it('renders and shows buttons', () => {
    const w = mount(App, { global: { stubs: { AppTitle: true, QBtn: QBtnStub } } })
    expect(w.find('[data-testid="btn-Group tabs"]').exists()).toBe(true)
    expect(w.find('[data-testid="btn-Ungroup"]').exists()).toBe(true)
    expect(w.find('[data-testid="btn-Manage plugin"]').exists()).toBe(true)
  })
  it('sends groupTabsByAge message on Group click', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined)
    const w = mount(App, { global: { stubs: { AppTitle: true, QBtn: QBtnStub } } })
    await w.find('[data-testid="btn-Group tabs"]').trigger('click')
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({
      action: BACKGROUND_MESSAGE_ACTIONS.GROUP_TABS_BY_AGE
    })
  })
  it('sends ungroupAllTabs message on Ungroup click', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined)
    const w = mount(App, { global: { stubs: { AppTitle: true, QBtn: QBtnStub } } })
    await w.find('[data-testid="btn-Ungroup"]').trigger('click')
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({
      action: BACKGROUND_MESSAGE_ACTIONS.UNGROUP_ALL_TABS
    })
  })
})
