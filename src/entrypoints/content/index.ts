/// <reference types="../../../.wxt/wxt.d.ts" />
import './style.css';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
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

    // Create UI container with WXT's integrated UI system
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container: HTMLElement) => {
        // Use centralized bootstrapper to initialize the app
        // This ensures consistent Vue + Pinia setup across all contexts
        AppBootstrapper.initUI({
          rootComponent: App,
          mountTarget: container,
        })
        console.log('✅ Content script UI mounted via AppBootstrapper')
        return { userScript: false };
      },
      onRemove: () => {
        console.log('Content script UI removed')
      },
    });

    // Mount the integrated UI
    ui.mount();
  },
});
