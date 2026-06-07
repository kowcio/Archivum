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
 *
 * Performance:
 * - Mount happens immediately with saved data from storage
 * - Fresh tab refresh happens in background (non-blocking)
 * - Storage watchers keep all open contexts in sync
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
   *
   * Non-blocking initialization:
   * 1. Mount app immediately with saved data (50-100ms)
   * 2. Load fresh data in background (300-700ms)
   * 3. Store updates automatically via watchers
   */
  static initUI(options: AppBootstrapperOptions): BootstrapperResult {
    const app = createApp(options.rootComponent)

    app.config.globalProperties.APP_VERSION = APP_CONSTANTS.APP_VERSION

    app.use(Quasar, {
      components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip },
    })

    const pinia = createPinia()
    pinia.use(appStoreSyncPlugin)
    app.use(pinia)

    const appStore = useAppStore()
    // Fire init in background without blocking mount
    appStore.init().catch((err) => console.error('[AppBootstrapper] init failed:', err))

    // Mount immediately with saved data + ready for reactivity
    app.mount(options.mountTarget)

    console.log('[AppBootstrapper] ✅ App mounted (UI mode)')
    return { app, pinia }
  }
}
