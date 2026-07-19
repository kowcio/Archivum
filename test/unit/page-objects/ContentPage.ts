import { type VueWrapper } from '@vue/test-utils';

/**
 * Page Object Model for Content App.vue (injected into web pages).
 */
export class ContentPage {
  constructor(private wrapper: VueWrapper) {}

  get root() {
    return this.wrapper.find('[data-testid="content-root"]');
  }

  get debug() {
    return this.wrapper.find('[data-testid="debug"]');
  }
}
