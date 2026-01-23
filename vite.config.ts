import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import webExtension from 'vite-plugin-web-extension'
import { transformAssetUrls } from '@quasar/vite-plugin'

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    vueDevTools(),
    webExtension({
      manifest: 'manifest.json',
      watchFilePaths: ['src/**/*', 'public/**/*'],
    }),
  ],

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "quasar/dist/quasar.sass";',
      },
    },
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    outDir: 'dist',
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[ext][extname]',
      },
    },
  },
})
