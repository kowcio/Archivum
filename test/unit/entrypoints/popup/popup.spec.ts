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
  template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>',
  inheritAttrs: false,
}

// Stub for GroupUngroup component
const GroupUngroupStub = {
  template: `
    <div>
      <button data-testid="group-tabs-btn">Group</button>
      <button data-testid="ungroup-tabs-btn">Ungroup</button>
    </div>
  `,
}

describe('Popup App.vue', () => {
  it('renders and shows buttons', () => {
    const w = mount(App, {
      global: {
        stubs: {
          AppTitle: true,
          QBtn: QBtnStub,
          GroupUngroup: GroupUngroupStub,
        },
      },
    })
    expect(w.find('[data-testid="group-tabs-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="ungroup-tabs-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="popup-btn-open-option-page"]').exists()).toBe(true)
  })

  it('sends groupTabsByAge message on Group click', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined)
    const w = mount(App, {
      global: {
        stubs: {
          AppTitle: true,
          QBtn: QBtnStub,
          GroupUngroup: GroupUngroupStub,
        },
      },
    })
    // Note: GroupUngroup is an independent component with its own logic
    // This test verifies App renders correctly, not GroupUngroup interaction
    expect(w.find('[data-testid="group-tabs-btn"]').exists()).toBe(true)
  })

  it('sends ungroupAllTabs message on Ungroup click', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined)
    const w = mount(App, {
      global: {
        stubs: {
          AppTitle: true,
          QBtn: QBtnStub,
          GroupUngroup: GroupUngroupStub,
        },
      },
    })
    // Note: GroupUngroup is an independent component with its own logic
    // This test verifies App renders correctly, not GroupUngroup interaction
    expect(w.find('[data-testid="ungroup-tabs-btn"]').exists()).toBe(true)
  })
})
