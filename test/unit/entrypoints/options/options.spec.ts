// @vitest-environment happy-dom

/**
 * Options App.vue tests — mounts REAL components via Quasar plugin.
 *
 * Uses fakeBrowser for storage/messaging — no manual mocks.
 * Quasar components registered globally same as AppBootstrapper does.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip } from 'quasar';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '@/entrypoints/options/App.vue';
import { OptionsPage } from '../../page-objects/OptionsPage';

beforeEach(() => {
  fakeBrowser.reset();
  setActivePinia(createPinia());
});

describe('Options App.vue', () => {
  function createPage() {
    const wrapper = mount(App, {
      global: {
        plugins: [
          createPinia(),
          [
            Quasar,
            {
              components: { QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip },
            },
          ],
        ],
      },
    });
    return { wrapper, page: new OptionsPage(wrapper) };
  }

  it('renders group and ungroup buttons (initial: group visible, ungroup hidden)', async () => {
    const { page } = createPage();
    await flushPromises();
    expect(page.groupBtn.exists()).toBe(true);
    expect(page.ungroupBtn.exists()).toBe(false);
  });

  it('renders thresholds config section', async () => {
    const { page } = createPage();
    await flushPromises();
    expect(page.thresholdsConfig.exists()).toBe(true);
  });

  it('renders app title', async () => {
    const { wrapper } = createPage();
    await flushPromises();
    // Title.vue renders inside a .got-title-bar div with "Archivum" text
    expect(wrapper.text()).toContain('Archivum');
    expect(wrapper.find('.got-title-bar').exists()).toBe(true);
  });

  it('clicking group toggle sends groupTabsByAge message', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage');
    const { page } = createPage();
    await page.clickGroup();
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalled();
  });
});
