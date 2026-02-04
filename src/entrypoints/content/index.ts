/// <reference types="../../../.wxt/wxt.d.ts" />
import './style.css';
import { createApp, type App as VueAppInstance } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useGlobalStore } from '@/shared/stores/globalStore';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',

  async main(ctx: ContentScriptContext) {
    console.log('[DEBUG] Content script starting to load...');
    console.log('[DEBUG] Current URL:', window.location.href);

    // Create UI container
    const ui = await createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container: HTMLElement) => {
        // Set up container styling
        container.id = 'my-vue-header';

        // Add styles for the container
        const style = document.createElement('style');
        style.textContent = `
          #my-vue-header {
            top: 2%;
            left: 2%;
            width: 96%;
            min-height: 10%;
            margin: 2%;
            z-index: 9999;
            padding: 10px 0;
            text-align: center;
            border: solid orange 2px;
          }
        `;
        document.head.appendChild(style);

        // Create Vue app with unified pattern (similar to popup/options)
        const app = createApp(App);
        const pinia = createPinia();
        app.use(pinia);

        // Initialize shared settings store
        const global = useGlobalStore();
        global.init().catch((err: unknown) => console.error('global.init failed', err));

        app.mount(container);

        console.log('✅ Content script Vue app mounted');

        return { app, style };
      },
      onRemove: (result: { app: VueAppInstance<Element>; style: HTMLStyleElement } | undefined) => {
        result?.app?.unmount();
        result?.style?.remove();
      },
    });

    // Mount the UI
    ui.mount();
  },
});


