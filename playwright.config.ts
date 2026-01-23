import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/playwright',
  timeout: 30000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list', { printSteps: true }],
    ['html', { printsteps: true, outputFolder: 'reports/playwright-report', open: 'never' }]
  ],
  outputDir: 'reports/test-results',

  use: {
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
    // Enable headless mode by default
    headless: true,
  },

  projects: [
    {
      name: 'firefox-mv2',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          slowMo: 50
        }
      },
    }
  ],

})
