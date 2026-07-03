import { createApp, type App as VueApp } from 'vue'
import { Quasar, QTable, QTd, QTr, QBtn, QBtnGroup, QInput, QTooltip, Dialog, Notify } from 'quasar'
import { APP_CONSTANTS } from '@/constants.ts'

/**
 * Centralized app bootstrapper for UI extension contexts (popup, options, content).
 *
 * NO Pinia. Using WXT storage as single source of truth.
 * Each component uses useAppStore() composable to get reactive state from storage.
 * Tabs are queried live from browser.tabs API in each context.
 */

export interface AppBootstrapperOptions {
  rootComponent: any
  mountTarget: string | HTMLElement
}

export interface BootstrapperResult {
  app: VueApp
}

export class AppBootstrapper {
  static initUI(options: AppBootstrapperOptions): BootstrapperResult {
    const app = createApp(options.rootComponent)
    app.config.globalProperties.APP_VERSION = APP_CONSTANTS.APP_VERSION

    app.use(Quasar, {
      components: { QTable, QTr, QTd, QBtn, QBtnGroup, QInput, QTooltip },
      plugins: { Dialog, Notify },
    })

    app.mount(options.mountTarget)
    console.log('[AppBootstrapper] ✅ App mounted with Dialog & Notify plugins (using WXT storage as single source of truth)')
    return { app }
  }
}


