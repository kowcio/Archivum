/// <reference types="../../../.wxt/wxt.d.ts" />
import './style.css';
import {type App as VueAppInstance, createApp} from 'vue';
import {createPinia} from 'pinia';
import App from './App.vue';
import {useGlobalStore} from '@/stores/globalStore.ts';
import type {ContentScriptContext} from 'wxt/utils/content-script-context';

export default defineContentScript({
  // upewnij się, że mamy wzorzec dla domeny bez subdomeny oraz z subdomenami
  matches: ['*://*.wxt.dev/*'],
  cssInjectionMode: 'ui',
  registration: 'manifest',

  async main(ctx: ContentScriptContext) {
    console.log('[DEBUG] Content script init:', {
      url: window.location.href,
      host: location.host,
      matches: ['*://kowalskipiotr.pl/*', '*://*.kowalskipiotr.pl/*'],
    });

    // Nie montujemy jeśli jesteśmy w iframe — WordPress może osadzać treści
    if (window.top !== window.self) {
      console.log('[DEBUG] Aborting mount: running inside an iframe.');
      return;
    }

    // Poczekaj aż body będzie dostępne (czasem theme/slow scripts opóźniają mount)
    await (async function waitForBody(timeoutMs = 5000) {
      const start = Date.now();
      while (!document.body) {
        if (Date.now() - start > timeoutMs) {
          console.warn('[DEBUG] waitForBody timed out after', timeoutMs, 'ms');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    })();

    // Create UI container
    const ui = createIntegratedUi(ctx, {
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
            border: solid red 20px;
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
        return {app, style};
      },
      onRemove: (result: {
        app: VueAppInstance<Element>;
        style: HTMLStyleElement;
      } | undefined) => {
        result?.app?.unmount();
        result?.style?.remove();
      },
    });

    // Obuduj montowanie w try/catch i zweryfikuj rezultat DOM
    try {
      ui.mount();
      // krótka pauza aby DOM mógł się zaktualizować
      await new Promise(resolve => setTimeout(resolve, 100));
      const el = document.getElementById('my-vue-header');
      if (el) {
        console.log('[DEBUG] UI container found in DOM:', el);
      } else {
        console.warn('[DEBUG] UI container NOT found after mount. Check anchor selectors and page structure.');
      }
    } catch (err) {
      console.error('[ERROR] ui.mount failed', err);
    }
  },
});
