import { type VueWrapper } from '@vue/test-utils'

/**
 * Page Object Model for Options App.vue.
 * Provides typed helpers for querying and interacting with the options page UI.
 */
export class OptionsPage {
  constructor(private wrapper: VueWrapper) {}

  /** GroupUngroup button (label changes: Group by age / Ungroup) */
  get groupToggleBtn() {
    return this.wrapper.find('[data-testid="popup-btn-group-tabs"], [data-testid="popup-btn-ungroup-tabs"]')
  }

  get groupBtn() {
    return this.wrapper.find('[data-testid="popup-btn-group-tabs"]')
  }

  get ungroupBtn() {
    return this.wrapper.find('[data-testid="popup-btn-ungroup-tabs"]')
  }

   get mockTabsBtn() {
     return this.wrapper.findAllComponents({ name: 'QBtn' }).find((w) =>
       w.text().includes('Mock 10 tabs'),
     )
   }

   get loadTabsBtn() {
     return this.wrapper.findAllComponents({ name: 'QBtn' }).find((w) =>
       w.text().includes('Load current tabs'),
     )
   }

  get thresholdsConfig() {
    return this.wrapper.find('[data-testid="thresholds-config"]')
  }

  get thresholdsReset() {
    return this.wrapper.find('[data-testid="threshold-reset"]')
  }

  get ageCells() {
    return this.wrapper.findAll('[data-testid^="cell-lastAccessAge-"]')
  }

  get errorText() {
    return this.wrapper.find('.error-text')
  }

  async clickGroup(): Promise<void> {
    await this.groupBtn.trigger('click')
  }

  async clickUngroup(): Promise<void> {
    await this.ungroupBtn.trigger('click')
  }

   async clickMockTabs(): Promise<void> {
     const btn = this.mockTabsBtn
     if (btn) await btn.trigger('click')
   }

   async clickLoadTabs(): Promise<void> {
     const btn = this.loadTabsBtn
     if (btn) await btn.trigger('click')
   }

  rowAgeTexts(): string[] {
    return this.ageCells.map(c => c.text())
  }
}
