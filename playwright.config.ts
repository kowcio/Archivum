import { defineConfig } from '@playwright/test'
import path from 'path'

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
      use: {
        browserName: 'chromium',
        channel: 'chrome', // Chrome channel required for headless extensions
        headless: true,
        launchOptions: {
          // Allow extension loading in headless by re-enabling extensions and deferring headless to args
          ignoreDefaultArgs: ['--disable-extensions', '--headless'],
        },
      },
    },
    {
      name: 'firefox-mv3',
      use: {
        browserName: 'firefox',
        headless: true,
        launchOptions: {
          firefoxUserPrefs: {
            'xpinstall.signatures.required': false,
            'extensions.experiments.enabled': true,
          },
        },
      },
    },
  ],
})
