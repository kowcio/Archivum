import {quasar} from '@quasar/vite-plugin'
// @ts-ignore
import {defineConfig} from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig((env: { browser: string }) => {
  const browser = env?.browser ?? 'chrome'

  return {
    modules: ['@wxt-dev/module-vue'],
    srcDir: 'src',
    modulesDir: 'modules',
    outDir: '.output',
    publicDir: 'public',
    entrypointsDir: 'entrypoints',

    manifest: (() => {
      const baseManifest = {
        name: 'Browser extension template.',
        description: 'Startup project for building browser extensions with Vue 3 and Vite.',
        version: '1.0.0',
        manifest_version: 3,
        permissions: ['tabs', 'activeTab', 'bookmarks', 'clipboardRead', 'storage', 'scripting'],
        content_scripts: [
          {
            matches: ['<all_urls>'],
            js: ['browser-polyfill.js'],
          },
        ],
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
        web_accessible_resources: [
          {
            resources: ['content-scripts/content.css'],
            matches: ['*://*/*'],
            use_dynamic_url: browser === 'chrome'
          },
          {
            resources: ['content-scripts/kowalski.css'],
            matches: ['*://*.wxt.dev/*'],
            use_dynamic_url: browser === 'chrome'
          },
        ],
      } as const

      if (browser === 'firefox') {
        return {
          ...baseManifest,
          content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'",
          },
          web_accessible_resources: baseManifest.web_accessible_resources.map(({
                                                                                 use_dynamic_url,
                                                                                 ...rest
                                                                               }) => rest),
        }
      }

      return {
        ...baseManifest,
        content_security_policy: {
          extension_pages: "script-src 'self'; object-src 'self'",
        },
      }
    })(),

    vite: () => ({
      // plugins: [
      //   quasar({
      //     sassVariables: 'src/quasar-variables.sass',
      //   }),
      // ],
    }),
  }
})
