import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import { useAppStore } from '@/stores/appStore.ts';
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip } from 'quasar';
import { APP_CONSTANTS } from '@/constants.ts';
import { appStoreSyncPlugin } from '@/stores/appStoreSyncPlugin.ts';

/**
 * Centralized app bootstrapper for UI extension contexts (popup, options, content).
 *
 * Architecture:
 * - background.ts does NOT use Pinia — it operates on browser.storage directly
 * - UI contexts (popup, options, content) each get their own Pinia instance
 * - Cross-context state sync is fully automatic via appStoreSyncPlugin:
 *     any context → tabStorageItem.setValue() → WXT watch fires
 *     → $patch({ tabs, isGrouped }) → Vue reactivity in every open context
 * - No manual loadTabsHistory() / initStorageSync() calls needed in components
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
  /**
   * Initialize Vue + Pinia for UI contexts (popup, options, content).
   */
  static async initUI(options: AppBootstrapperOptions): Promise<BootstrapperResult> {
    const app = createApp(options.rootComponent)

    app.config.globalProperties.APP_VERSION = APP_CONSTANTS.APP_VERSION

    app.use(Quasar, {
      components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip },
    })

    const pinia = createPinia()
    pinia.use(appStoreSyncPlugin)
    app.use(pinia)

    const appStore = useAppStore()
    await appStore.init().catch((err) => console.error('AppStore.init failed:', err))

    app.mount(options.mountTarget)

    console.log('✅ App initialized (UI mode)')
    return { app, pinia }
  }
}
