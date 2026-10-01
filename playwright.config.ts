import { defineConfig } from '@playwright/test'

const width = 1600;
const height = 900;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './test/playwright',
  // ── EXTENSION TEST TIMEOUTS (longer than typical web tests) ──
  // Extension setup + content loading + interaction can be slow
  timeout: isCI ? 150_000 : 90_000,  // Increased to 90s locally, 150s on CI (MV3 service worker can be slow)
  expect: { timeout: 20_000 },  // Global timeout for all expect() assertions: 20 seconds (covers web-first assertions)

  // ── RETRIES & FLAKINESS DETECTION ──
  // Retry flaky tests on CI, fail fast on obvious issues
  retries: isCI ? 2 : 0,  // 2 retries on CI (extension setup may timeout once), 0 locally
  failOnFlakyTests: false,  // Fail CI if tests are marked flaky

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
    // Extension navigation requires more time than regular web pages
    // Service worker startup + Vue hydration + background script sync can take 20-40s
    // Use HIGHER values locally to avoid flakiness; CI has more resources
    navigationTimeout: isCI ? 60_000 : 60_000,  // 60s everywhere (extension pages need full hydration)
    actionTimeout: isCI ? 30_000 : 15_000,  // CI: 30s, Local: 15s
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
