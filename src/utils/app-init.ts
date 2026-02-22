import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import { useGlobalStore } from '@/stores/globalStore.ts';
import { Quasar, QTable, QTd, QTr } from 'quasar';
import { APP_VERSION } from '@/globals';

/**
 * Single initialization point for all extension contexts (popup, options, content)
 * This ensures consistent setup across all entry points
 */
export interface AppInitOptions {
  rootComponent: any;
  mountTarget: string | HTMLElement;
}

export interface InitializedApp {
  app: VueApp;
  pinia: Pinia;
}

/**
 * Initialize Vue app with Pinia and global store
 * This is the single source of truth for app initialization
 */
export async function initializeApp(options: AppInitOptions): Promise<InitializedApp> {
  const { rootComponent, mountTarget } = options;

  // Create Vue app
  const app = createApp(rootComponent);

  // Add global properties
  app.config.globalProperties.APP_VERSION = APP_VERSION;

  // Quasar components (add more when you use them in your components)
  app.use(Quasar, {
    components: {
      QTable,
      QTr,
      QTd,
    },
  });

  // Create and use Pinia
  const pinia = createPinia();
  app.use(pinia);

  // Initialize global store (loads from storage and sets up sync)
  const global = useGlobalStore();
  await global.init().catch((err) => console.error('global.init failed', err));

  // Mount the app
  app.mount(mountTarget);

  console.log('✅ App initialized successfully');

  return { app, pinia };
}
