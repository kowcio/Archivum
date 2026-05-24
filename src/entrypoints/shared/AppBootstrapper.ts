import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import { useGlobalStore } from '@/stores/globalStore.ts';
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip } from 'quasar';
import { APP_CONSTANTS } from '@/constants.ts';

/**
 * Centralized app bootstrapper for all extension contexts (popup, options, content).
 * Ensures consistent initialization of Vue, Pinia, and global services across entry points.
 *
 * Architecture:
 * - Each entrypoint (popup, options, content, background) calls this factory
 * - No singletons — each instance gets its own Pinia store
 * - Background initializes only Pinia without Vue (no DOM)
 */

export interface AppBootstrapperOptions {
  rootComponent?: any;
  mountTarget?: string | HTMLElement;
}

export interface BootstrapperResult {
  app?: VueApp;
  pinia: Pinia;
}

/**
 * Factory class for creating and initializing app instances.
 * Static methods ensure no global state shared between contexts.
 */
export class AppBootstrapper {
  /**
   * Initialize Vue + Pinia for UI contexts (popup, options, content).
   * Call this from entry points that need DOM rendering.
   */
  static async initUI(options: AppBootstrapperOptions): Promise<BootstrapperResult> {
    if (!options.rootComponent || !options.mountTarget) {
      throw new Error('UI initialization requires rootComponent and mountTarget')
    }

    // 1. Create Vue app
    const app = createApp(options.rootComponent)

    // 2. Add global properties
    app.config.globalProperties.APP_VERSION = APP_CONSTANTS.APP_VERSION

    // 3. Register Quasar UI components
    app.use(Quasar, {
      components: {
        QTable,
        QTr,
        QTd,
        QBtn,
        QBtnGroup,
        QInput,
        QTooltip,
      },
    })

    // 4. Create and use Pinia
    const pinia = createPinia()
    app.use(pinia)

    // 5. Initialize global store (loads from storage + sync listeners)
    const global = useGlobalStore()
    await global.init().catch((err) => console.error('GlobalStore.init failed:', err))

    // 6. Mount to DOM
    app.mount(options.mountTarget)

    console.log('✅ App initialized (UI mode)')

    return { app, pinia }
  }

  /**
   * Initialize only Pinia for non-UI contexts (background worker).
   * Call this from background.ts to set up stores without DOM overhead.
   */
  static async initBackground(): Promise<BootstrapperResult> {
    // 1. Create Pinia store only (no Vue app needed)
    const pinia = createPinia()

    // 2. Initialize global store (loads thresholds from storage)
    const global = useGlobalStore()
    // Note: global.init() is async but background main() cannot be async
    // Services (ExtensionCleanupService, TabUpdateService) will use the store
    // when they are called, ensuring it's ready even if init is still pending
    global.init().catch((err) => console.error('GlobalStore.init failed:', err))

    console.log('✅ App initialized (Background mode)')

    return { pinia }
  }
}

