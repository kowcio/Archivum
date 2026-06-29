import { defineConfig } from '@playwright/test'

const width = 1600;
const height = 900;

export default defineConfig({
  testDir: './test/playwright',
  timeout: 30000,
  expect: { timeout: 15000 },  // Global timeout for all expect() assertions: 15 seconds
  fullyParallel: false,
  reporter: [
    ['list', { printSteps: true }],
    ['html', { printSteps: true, outputFolder: 'reports/playwright-report', open: 'never' }],
  ],
  outputDir: 'reports/test-results',
  use: {
    headless: true,
    viewport: { width: width, height: height },
    launchOptions: {
      args: ['--window-size=' + width + ',' + height],
    },
  },
  projects: [
    {
      // Primary: Chrome/Chromium automated extension tests
      // Reliable service worker support, full Playwright extension support
      name: 'chrome-mv3',
      use: { browserName: 'chromium' },
    },
    // Secondary: Firefox manual testing guide
    // Limited Playwright MV3 support - use for manual testing only
    // Uncomment to enable:
    // {
    //   name: 'firefox-mv3',
    //   use: { browserName: 'firefox' },
    // },
  ],
})
