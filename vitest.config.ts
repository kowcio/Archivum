
import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '**/node_modules/**', 'dist/**', 'e2e/**'],
    include: ['test/**/*.spec.{js,ts,vue}'],

    // VS Code IDE friendly
    globals: true,
    setupFiles: ['test/unit/__mocks__/webextension-polyfill.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
