import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/playwright',
  timeout: 30000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list', { printSteps: true }],
    ['html', { printSteps: true, outputFolder: 'reports/playwright-report', open: 'never' }]
  ],
  outputDir: 'reports/test-results',

  use: {
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: {
      slowMo: 50,
    },
  },

})
