import { quasar } from '@quasar/vite-plugin';
// @ts-ignore
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: 'src', // This sets up @ alias automatically
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
  webExt: {
    binaries: {
      firefox: 'C:/Program Files/Mozilla Firefox/firefox.exe',
    },
    startUrls: ['about:debugging#/runtime/this-firefox'],
    openConsole: true,
  },
  vite: () => ({
    plugins: [
      quasar({
        sassVariables: 'src/quasar-variables.sass',
      }),
    ],
  }),
});
