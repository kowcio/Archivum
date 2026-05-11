/// <reference types="../../../.wxt/wxt.d.ts" />
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  registration: 'manifest',

  async main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container) => {
        const app = createApp(App).use(createPinia());
        app.mount(container);
        return app;
      },
      onRemove: (app) => app?.unmount(),
    });
    ui.mount();
  },
});

