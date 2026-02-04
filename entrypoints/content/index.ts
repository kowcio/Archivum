import './style.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useGlobalStore } from '../../src/shared/stores/globalStore';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    console.log('[DEBUG] Content script starting to load...');
    console.log('[DEBUG] Current URL:', window.location.href);

    // Create UI container
    const ui = await createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container) => {
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
            border: solid orange 2px;
          }
        `;
        document.head.appendChild(style);

        // Create Vue app
        const app = createApp(App);
        const pinia = createPinia();
        app.use(pinia);

        // Initialize shared settings store
        const global = useGlobalStore();
        global.init().catch((err) => console.error('global.init failed', err));

        app.mount(container);
        return { app, style };
      },
      onRemove: ({ app, style }) => {
        app?.unmount();
        style?.remove();
      },
    });

    // Mount the UI
    ui.mount();
  },
});
