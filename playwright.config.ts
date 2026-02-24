import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/playwright',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  reporter: [
    ['list', { printSteps: true }],
    ['html', { printSteps: true, outputFolder: 'reports/playwright-report', open: 'never' }],
  ],
  outputDir: 'reports/test-results',
  use: {
    headless: true,
  },
  projects: [
    {
      name: 'chrome-mv3',
      use: { browserName: 'chromium', headless: true },
    },
  ],
})
