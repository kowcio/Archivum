import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/playwright',
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
      name: 'chromium-mv2',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          slowMo: 50
        }
      },
    }
  ],

  webServer: {
    command: 'npm run build',  // Build extension first
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
})
