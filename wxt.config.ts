import { defineConfig } from 'wxt';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Browser extension template.',
    description: 'Startup project for building browser extensions with Vue 3 and Vite.',
    version: '1.0.0',
    permissions: ['tabs', 'activeTab', 'bookmarks', 'clipboardRead', 'storage'],
    browser_specific_settings: {
      gecko: {
        id: 'browserExtensionTemplate@Kowalski',
      },
    },
  },
  runner: {
    binaries: {
      firefox: 'C:/Program Files/Firefox Developer Edition/firefox.exe',
    },
    startUrls: ['about:debugging#/runtime/this-firefox'],
    browserConsole: true,
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [
      quasar({
        sassVariables: 'src/quasar-variables.sass',
      }),
    ],
  }),
});
