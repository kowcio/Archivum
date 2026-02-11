import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/playwright',
  timeout: 60000,
  expect: { timeout: 10000 },
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

  projects: [
    {
      name: 'chrome-mv3',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox-mv2',
      use: { browserName: 'firefox' },
    },
  ],
})
