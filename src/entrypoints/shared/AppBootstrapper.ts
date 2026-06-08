import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import { useConfigStore } from '@/stores/configStore.ts';
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip } from 'quasar';
import { APP_CONSTANTS } from '@/constants.ts';

/**
 * Centralized app bootstrapper for UI extension contexts (popup, options, content).
 *
 * Minimal: Vue + Pinia + configStore only. No tab persistence.
 * Tabs are queried live from browser.tabs API in each context.
 */

export interface AppBootstrapperOptions {
  rootComponent: any;
  mountTarget: string | HTMLElement;
}

export interface BootstrapperResult {
  app: VueApp;
  pinia: Pinia;
}

export class AppBootstrapper {
  static initUI(options: AppBootstrapperOptions): BootstrapperResult {
    const app = createApp(options.rootComponent)
    app.config.globalProperties.APP_VERSION = APP_CONSTANTS.APP_VERSION

    app.use(Quasar, {
      components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip },
    })

    const pinia = createPinia()
    app.use(pinia)

    // Load config in background (thresholds)
    const configStore = useConfigStore()
    configStore.load()
    configStore.watch()

    app.mount(options.mountTarget)
    console.log('[AppBootstrapper] ✅ App mounted')
    return { app, pinia }
  }
}
