import { defineConfig } from '@playwright/test'

const width = 1600;
const height = 900;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './test/playwright',
  // ── EXTENSION TEST TIMEOUTS (longer than typical web tests) ──
  // Extension setup + content loading + interaction can be slow
  timeout: isCI ? 120_000 : 60_000,  // 120s on CI (extension setup overhead), 60s locally
  expect: { timeout: 15_000 },  // Global timeout for all expect() assertions: 15 seconds

  // ── RETRIES & FLAKINESS DETECTION ──
  // Retry flaky tests on CI, fail fast on obvious issues
  retries: isCI ? 2 : 0,  // 2 retries on CI (extension setup may timeout once), 0 locally
  failOnFlakyTests: isCI,  // Fail CI if tests are marked flaky

  // ── PARALLELISM CONTROL ──
  // CI: Run sequentially (1 worker) for maximum stability & reproducibility
  // Local: Run sequentially too (extension tests need isolation)
  fullyParallel: false,
  workers: isCI ? 1 : 1,  // Always 1 worker for extension tests (no parallel isolation)

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
    // ── NAVIGATION & ACTION TIMEOUTS ──
    // Extension navigation can be slower than regular web navigation
    navigationTimeout: isCI ? 30_000 : 15_000,  // 30s on CI, 15s locally
    actionTimeout: isCI ? 15_000 : 10_000,      // 15s on CI, 10s locally
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
