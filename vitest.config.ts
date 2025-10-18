import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'
import vue from '@vitejs/plugin-vue'

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      vue({
        // include: ['src/**/*.vue'], // only include .vue files in the src directory
        // exclude: ['src/stores/**/*'], // exclude the stores directory
      }),
    ],
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      include: ['src/tests/**/*.{test,spec}.{js,ts,vue}'], // add test folders here
    },
  }),
)
