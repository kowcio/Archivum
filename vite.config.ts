import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import webExtension from 'vite-plugin-web-extension'
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
      manifest: 'manifest.json',
      watchFilePaths: ['src/**/*', 'public/**/*'],
      skipManifestValidation: false,
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "quasar/dist/quasar.sass";',
      },
    },
  },
  base: './',

  build: {
    outDir: 'dist',
    minify: 'esbuild',
    cssMinify: true,
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
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
