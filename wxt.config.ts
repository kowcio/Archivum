import {quasar} from '@quasar/vite-plugin'
// @ts-ignore
import {defineConfig} from 'wxt'
import * as nodeCrypto from 'node:crypto'

import packageJson from './package.json'

// Polyfill crypto.hash for Node versions <22 used by @vitejs/plugin-vue
if (!('hash' in nodeCrypto) && typeof nodeCrypto.createHash === 'function') {
  const cryptoWithHash = nodeCrypto as typeof import('node:crypto') & {
    hash?: typeof nodeCrypto.createHash
  }
  cryptoWithHash.hash = (algorithm: string, data: string, encoding: import('node:crypto').BinaryToTextEncoding) =>
    nodeCrypto.createHash(algorithm).update(data).digest(encoding)
}

// See https://wxt.dev/api/config.html
export default defineConfig((env: { browser: string }) => {
  const browser = env?.browser ?? 'chrome'

  const webAccessibleResources = [
    {
      resources: ['content-scripts/content.css'],
      matches: ['*://*/*'],
    },
    {
      resources: ['content-scripts/kowalski.css'],
      matches: ['*://*.wxt.dev/*'],
    },
  ] as const

  const chromeWebAccessibleResources = webAccessibleResources.map((resource) => ({
    ...resource,
    use_dynamic_url: true,
  }))

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
        permissions: ['tabs', 'activeTab', 'bookmarks', 'clipboardRead', 'storage'],
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
        web_accessible_resources: browser === 'chrome' ? chromeWebAccessibleResources : webAccessibleResources,
      } as const

      if (browser === 'firefox') {
        return {
          ...baseManifest,
          content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'",
          },
          web_accessible_resources: webAccessibleResources,
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
      define: {
        __VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.1'),
      },
      plugins: [
        quasar({
          sassVariables: 'src/quasar-variables.sass',
        }),
      ],
    }),
  }
})
