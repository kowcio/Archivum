/// <reference types="../../../.wxt/wxt.d.ts" />
import './style.css';
import {type App as VueAppInstance, createApp} from 'vue';
import {createPinia} from 'pinia';
import App from './App.vue';
import type {ContentScriptContext} from 'wxt/utils/content-script-context';

// Import browser polyfill for Firefox compatibility
import 'webextension-polyfill';

console.debug('[EXT-DBG] content (general) initializing - TOKEN:EXT_DBG_CONTENT_GENERAL_v1');

export default defineContentScript({
  matches: ['*://*/*'],
  registration: 'manifest',

  async main(ctx: ContentScriptContext) {
    console.debug('[EXT-DBG] content main running - TOKEN:EXT_DBG_CONTENT_MAIN_v1');
    console.log('[DEBUG] Content GENERAL script starting to load...');
    console.log('[DEBUG] Current URL:', window.location.href);

    // Create UI container
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container: HTMLElement) => {
        // Create Vue app with unified pattern (similar to popup/options)
        const app = createApp(App);
        const pinia = createPinia();
        app.use(pinia);

        app.mount(container);

        console.log('✅ Content script Vue app mounted');

        return app;
      },
      onRemove: (app: VueAppInstance<Element> | undefined) => {
        app?.unmount();
      },
    });

    // Mount the UI
    ui.mount();
  },
});
