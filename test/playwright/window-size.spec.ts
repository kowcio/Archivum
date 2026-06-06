/**
 * Diagnostic test — verifies that browser window size is applied correctly.
 *
 * Run:
 *   npx playwright test test/playwright/window-size.spec.ts --project chrome-mv3 --headed
 */
import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const TARGET_WIDTH  = 1280
const TARGET_HEIGHT = 800
const EXT_DIR = path.resolve(process.cwd(), '.output', 'chrome-mv3')

test('browser window size is applied via launchPersistentContext', async () => {
  test.setTimeout(30_000)

  const userDataDir = path.resolve(process.cwd(), '.output', 'pw-profile-window-size')
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
  fs.mkdirSync(userDataDir, { recursive: true })

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
      `--window-size=${TARGET_WIDTH},${TARGET_HEIGHT}`,
      '--window-position=100,100',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: TARGET_WIDTH, height: TARGET_HEIGHT },
  })

  const page = await context.newPage()
  await page.goto('about:blank')

  const innerWidth  = await page.evaluate(() => window.innerWidth)
  const innerHeight = await page.evaluate(() => window.innerHeight)
  const outerWidth  = await page.evaluate(() => window.outerWidth)
  const outerHeight = await page.evaluate(() => window.outerHeight)

  console.log(`[window-size] viewport: ${TARGET_WIDTH}x${TARGET_HEIGHT}`)
  console.log(`[window-size] innerWidth=${innerWidth}  innerHeight=${innerHeight}`)
  console.log(`[window-size] outerWidth=${outerWidth}  outerHeight=${outerHeight}`)

  const vp = page.viewportSize()
  console.log(`[window-size] page.viewportSize()=${JSON.stringify(vp)}`)

  expect(vp?.width).toBe(TARGET_WIDTH)
  expect(vp?.height).toBe(TARGET_HEIGHT)

  await context.close()
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
