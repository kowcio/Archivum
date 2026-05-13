/**
 * Extension E2E tests – Playwright + bundled Chromium (channel: 'chromium').
 *
 * Run:
 *   npx playwright test test/playwright/App.spec.ts --project chrome-mv3
 *   SKIP_BUILD=1 npx playwright test test/playwright/App.spec.ts --project chrome-mv3
 */

import { test as base, chromium, expect, type BrowserContext } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const EXT_DIR = path.resolve(process.cwd(), '.output', 'chrome-mv3')

// ---------------------------------------------------------------------------
// Fixtures – official Playwright pattern for MV3 extensions
// ---------------------------------------------------------------------------

type ExtFixtures = {
  context: BrowserContext
  extensionId: string
}

export const test = base.extend<ExtFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
      ],
    })
    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 })
    }
    const extensionId = serviceWorker.url().split('/')[2]
    console.log('[extensionId]', extensionId)
    await use(extensionId)
  },
})

// ---------------------------------------------------------------------------
// Build once before all tests
// ---------------------------------------------------------------------------
test.beforeAll(() => {
  if (process.env.SKIP_BUILD === '1') {
    console.log('Skipping build (SKIP_BUILD=1)')
    return
  }
  console.log('Building extension…')
  execSync('npm run build-only', { stdio: 'inherit', cwd: process.cwd() })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Extension Mounting', () => {

  // 1. Static: build output exists
  test('build produces extension output', () => {
    const manifest = path.join(EXT_DIR, 'manifest.json')
    expect(fs.existsSync(EXT_DIR), `Dir missing: ${EXT_DIR}`).toBe(true)
    expect(fs.existsSync(manifest), 'manifest.json missing').toBe(true)

    const mf = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as { manifest_version: number; name: string }
    expect(mf.manifest_version).toBe(3)
    console.log('manifest.json OK ✓ name:', mf.name)
  })

  // 2. Extension loads – valid ID from service worker
  test('extension loads and has a valid ID', async ({ extensionId }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/)
    console.log('Extension ID ✓', extensionId)
  })

  // 3. Popup page
  test('popup page mounts correctly', async ({ context, extensionId }) => {
    test.setTimeout(30_000)
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' })

    try {
      await expect(page.getByRole('heading', { name: /popup/i })).toBeVisible({ timeout: 8_000 })
    } catch {
      console.error('[popup] HTML:', (await page.content()).slice(0, 800))
      throw new Error('Popup heading not found')
    }
    await expect(page.getByRole('button', { name: /tabs/i })).toBeVisible()
    console.log('Popup ✓')
  })

  // 4. Options page
  test('options page mounts correctly', async ({ context, extensionId }) => {
    test.setTimeout(30_000)
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })

    try {
      await expect(page.locator('#options')).toBeVisible({ timeout: 8_000 })
    } catch {
      console.error('[options] HTML:', (await page.content()).slice(0, 800))
      throw new Error('Options #options not found')
    }
    await expect(page.getByTestId('btn-load-tabs')).toBeVisible()
    console.log('Options ✓')
  })

  // 5. Content script on example.com
  test('content script injects on example.com', async ({ context }) => {
    test.setTimeout(40_000)
    const page = await context.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('[page]', msg.text())
    })

    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' })

    try {
      await expect(page.getByTestId('content-root')).toBeVisible({ timeout: 12_000 })
    } catch {
      const dir = path.resolve(process.cwd(), 'reports', 'test-results')
      fs.mkdirSync(dir, { recursive: true })
      await page.screenshot({ path: path.join(dir, 'content-fail.png') })
      console.error('[content] HTML:', (await page.content()).slice(0, 800))
      throw new Error('[content-root] not visible – screenshot saved')
    }
    console.log('Content script ✓')
  })

  // 6. No critical console errors
  test('no critical console errors on example.com', async ({ context }) => {
    test.setTimeout(40_000)
    const page = await context.newPage()
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const t = msg.text()
        if (!t.includes('favicon') && !t.includes('net::ERR_') && !t.includes('wxt') && !t.includes('chrome-extension')) {
          errors.push(t)
        }
      }
    })

    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('content-root')).toBeVisible({ timeout: 12_000 })
    expect(errors, `Critical console errors:\n${errors.join('\n')}`).toHaveLength(0)
    console.log('No critical errors ✓')
  })
})
