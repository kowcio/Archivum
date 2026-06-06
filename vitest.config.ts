import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'src': path.resolve(__dirname, 'src'),
      '#imports': path.resolve(__dirname, 'test/mocks/wxt-imports.ts'),
      quasar: path.resolve(__dirname, 'node_modules/quasar/dist/quasar.client.js'),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '**/node_modules/**', '.output/**', 'reports/**'],
    include: [
      'test/unit/**/*.spec.{js,ts,vue}',
    ],

    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './reports/coverage'
    }
  }
})
