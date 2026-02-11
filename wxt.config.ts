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
    manifest_version: 3,
    permissions: ['tabs', 'activeTab', 'bookmarks', 'clipboardRead', 'storage'],
    // Add browser polyfill for Firefox compatibility
    content_security_policy: "script-src 'self' 'unsafe-eval'; object-src 'self'",
    // Include browser polyfill in all content scripts
    content_scripts: [{
      matches: ['<all_urls>'],
      js: ['browser-polyfill.js']
    }],
    // Add background script
    background: {
      service_worker: 'background.js',
      type: 'module'
    },
  },
  vite: () => ({
    plugins: [
      quasar({
        sassVariables: 'src/quasar-variables.sass',
      }),
    ],
  }),
});
