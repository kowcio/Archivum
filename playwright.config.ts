import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'src/test/playwright',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html'], ['list']],

  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure'
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

  // Use global setup to prepare the extension and profile so tests are self-contained.
  // globalSetup: './test/playwright/global-setup.js',

  // use: {
  //   trace: 'on-first-retry',
  //   video: 'retain-on-failure',
  //   // Allow using a system firefox executable via env var PLAYWRIGHT_FIREFOX_EXECUTABLE
  //   launchOptions: {
  //     executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE || undefined
  //   }
  // }
})
