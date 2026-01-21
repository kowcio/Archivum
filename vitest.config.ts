
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
    exclude: [...configDefaults.exclude, '**/node_modules/**', 'dist/**', 'e2e/**', 'test/unit/**'],
    include: ['src/test/unit/**/*.spec.{js,ts,vue}'],

    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
