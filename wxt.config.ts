// @ts-ignore
import {defineConfig} from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig((env: { browser: string }) => {
  const browser = env?.browser ?? 'chrome'
  const isFirefox = browser === 'firefox'

  return {
    modules: ['@wxt-dev/module-vue'],
    srcDir: 'src',
    outDir: '.output',
    publicDir: 'public',
    entrypointsDir: 'entrypoints',

    manifest: {
      name: 'Browser extension template.',
      description: 'Startup project for building browser extensions with Vue 3 and Vite.',
      version: '1.0.0',
      manifest_version: 3,
      permissions: ['tabs', 'activeTab', 'bookmarks', 'clipboardRead', 'storage', 'scripting'],
      content_scripts: [],
      background: {
        service_worker: 'background.js',
        type: 'module',
      },
      action: {
        default_title: 'Browser Extension Popup',
        default_popup: 'popup.html',
      },
      options_ui: {
        page: 'options.html',
        open_in_tab: true,
      },
      // Simplified web_accessible_resources - only content.css
      // web_accessible_resources: [
      //   {
      //     resources: ['content-scripts/content.css'],
      //     matches: ['*://*/*'],
      //     ...(isFirefox ? {} : { use_dynamic_url: true }), // Chrome only
      //   },
      // ],
      // CSP for extension pages
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'",
      },
    },

    vite: () => ({}),
  }
})
