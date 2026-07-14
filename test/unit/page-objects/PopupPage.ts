import { type VueWrapper } from '@vue/test-utils';

/**
 * Page Object Model for Popup App.vue.
 * Uses data-testid attributes for reliable element selection.
 */
export class PopupPage {
  constructor(private wrapper: VueWrapper) {}

  get groupBtn() {
    return this.wrapper.find('[data-testid="btn-Group tabs"]');
  }

  get ungroupBtn() {
    return this.wrapper.find('[data-testid="btn-Ungroup"]');
  }

  get managePluginBtn() {
    return this.wrapper.find('[data-testid="btn-Manage plugin"]');
  }

  get browserOptionsBtn() {
    return this.wrapper.find('[data-testid="btn-Browser options"]');
  }

  async clickGroup(): Promise<void> {
    await this.groupBtn.trigger('click');
  }

  async clickUngroup(): Promise<void> {
    await this.ungroupBtn.trigger('click');
  }

  async clickManagePlugin(): Promise<void> {
    await this.managePluginBtn.trigger('click');
  }
}
