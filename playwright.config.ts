import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/playwright',
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
      // Primary: Chrome/Chromium automated extension tests
      // Reliable service worker support, full Playwright extension support
      name: 'chrome-mv3',
      use: { browserName: 'chromium' },
    },
    {
      // Secondary: Firefox manual testing guide
      // Limited Playwright MV3 support - use for manual testing only
      name: 'firefox-mv3-gui',
      use: { browserName: 'firefox' },
    },
  ],
})
