import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { WxtVitest } from 'wxt/testing/vitest-plugin'
import path from 'path'
import { quasar } from '@quasar/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    WxtVitest(),
    quasar(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'src': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.VITE_DEV_FEATURES': JSON.stringify('true'),
  },
  test: {
    environment: 'happy-dom',
    include: ['test/unit/**/*.spec.{js,ts,vue}'],
     exclude: ['**/node_modules/**', '.output/**', 'reports/**', 'test/playwright/**'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './reports/coverage',
    },
  },
})
