/// <reference types="../../../.wxt/wxt.d.ts" />
import './style.css';
import type { App as VueAppInstance } from 'vue';
import type { Pinia } from 'pinia';
import App from './App.vue';
import { AppBootstrapper } from '@/entrypoints/shared/AppBootstrapper';
import { disposeAllStores } from '@/stores/tabStoreSyncPlugin';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

export default defineContentScript({
  // upewnij się, że mamy wzorzec dla domeny bez subdomeny oraz z subdomenami
  matches: ['*://*.wxt.dev/*'],
  cssInjectionMode: 'ui',
  registration: 'manifest',

  async main(ctx: ContentScriptContext) {
    console.log('[DEBUG] Content script init:', {
      url: window.location.href,
      host: location.host,
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

        // Use AppBootstrapper so tabStoreSyncPlugin is registered automatically.
        // This gives this content script the same storage sync as popup and options.
        let appInstance: VueAppInstance | undefined;
        let piniaInstance: Pinia | undefined;
        AppBootstrapper.initUI({ rootComponent: App, mountTarget: container })
          .then(({ app, pinia }) => {
            appInstance = app;
            piniaInstance = pinia;
            console.log('✅ kowalski.content Vue app mounted via AppBootstrapper');
          })
          .catch((err: unknown) => console.error('Failed to mount kowalski.content UI:', err));

        return { style, getApp: () => appInstance, getPinia: () => piniaInstance };
      },
      onRemove: (result: { style: HTMLStyleElement; getApp: () => VueAppInstance | undefined; getPinia: () => Pinia | undefined } | undefined) => {
        // Dispose all Pinia stores before unmounting — Pinia does NOT do this automatically.
        // Critical: disposeAllStores() calls $dispose() on every store, which calls unwatch()
        // on the tabStorageItem watcher. Without this, the storage.onChanged listener
        // leaks and keeps firing after the content script is invalidated.
        const pinia = result?.getPinia?.()
        if (pinia) disposeAllStores(pinia)
        result?.getApp()?.unmount();
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
