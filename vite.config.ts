import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import webExtension from 'vite-plugin-web-extension'
import copy from 'rollup-plugin-copy'
import { transformAssetUrls } from '@quasar/vite-plugin'
export default defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls,
      },
    }),
    vueDevTools(),
    webExtension({
      browser: 'firefox',
      manifest: 'manifest.json',
      watchFilePaths: ['src/**/*', 'public/**/*'],
    }),
    copy({
      targets: [
        { src: 'src/assets/*', dest: 'dist/assets' },
        { src: 'public/*', dest: 'dist' },
        { src: 'src/*.[js,ts]', dest: 'dist' },
      ],
      hook: 'writeBundle',
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "quasar/dist/quasar.sass";',
      },
    },
  },
  base: './', //Base public path when served in development or production.

  build: {
    outDir: 'dist',
    minify: false,
    cssMinify: false,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },

  resolve: {
    alias: {
      '@': require('path').resolve(__dirname, 'src'),
    },
  },
})
