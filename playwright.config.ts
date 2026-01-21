import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'src/test/playwright',
  timeout: 30000,
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

})
