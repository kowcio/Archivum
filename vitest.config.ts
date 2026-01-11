// import { fileURLToPath } from 'node:url'
// import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
// import viteConfig from './vite.config'
// import vue from '@vitejs/plugin-vue'

// export default mergeConfig(
//   viteConfig,
//   defineConfig({
//     plugins: [vue()],
//     test: {
//       environment: 'jsdom',  // Default for Vue/unit tests
//       exclude: [...configDefaults.exclude, '**/node_modules/**', 'dist/**'],
//       include: [
//         'src/tests/**/*.{test,spec}.{js,ts,vue}',
//         'e2e/**/*.test.ts'   // Extension E2E (unit-style only)
//       ],
//       root: fileURLToPath(new URL('./', import.meta.url)),

//       // Fix pool/threading issues
//       poolOptions: {
//         threads: {
//           singleThread: true  // Single thread for stability (no race conditions)
//         }
//       },

//       // Global test setup (create if missing)
//       setupFiles: ['./src/setupTests.ts'],  // .ts for TypeScript

//       // Vitest-specific globals/polyfills
//       globals: true,
//       environmentOptions: {
//         jsdom: {
//           parsedErrors: true
//         }
//       },

//       // Coverage (optional)
//       coverage: {
//         provider: 'v8',
//         reporter: ['text', 'json', 'html']
//       }
//     },
//   })
// )
