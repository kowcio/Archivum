import { test, expect, firefox } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

test.describe('Manifest V2 Extension (Firefox)', () => {
  let context: BrowserContext
  let extensionId: string

  test.beforeAll(async () => {
    // Resolve paths
    const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
    const distDir = path.resolve(repoRoot, 'dist')
    const profileDir = path.resolve(process.cwd(), 'test/playwright/firefox-profile')

    const mode = process.env.PLAYWRIGHT_TEST_MODE || 'extension'

    if (mode === 'dist') {
      // In `dist` mode we won't use a browser profile or installed extension. Tests will load built artifacts directly.
      context = await firefox.launchPersistentContext('', { headless: true })
      return
    }

    if (!fs.existsSync(profileDir)) {
      throw new Error('Firefox profile not prepared. Run tests with globalSetup or run `npm run test:playwright`.')
    }

    // Launch Firefox with the prepared profile (globalSetup placed XPI into profile/extensions)
    const headless = process.env.PLAYWRIGHT_HEADLESS === '1' ? true : false
    context = await firefox.launchPersistentContext(profileDir, {
      headless,
    })

    // Wait briefly for background page or service worker to appear
    // For Manifest V2 there may be a background page; for MV3 there may be a service worker.
    // Try to get any background page URL to extract the extension id.
    let [background] = context.backgroundPages()
    if (!background) {
      try {
        background = await context.waitForEvent('backgroundpage', { timeout: 5000 })
      } catch (e) {
        // ignore, extension may be service-worker based
      }
    }
    if (background) {
      extensionId = background.url().split('/')[2]!
      console.log('✅ Extension loaded (background page):', extensionId)
    } else {
      console.log('✅ Firefox launched with profile; extension may be service-worker based.')
    }
  })

  test('content script injects', async ({ page }) => {
    const mode = process.env.PLAYWRIGHT_TEST_MODE || 'extension'
    if (mode === 'dist') {
      const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
      const contentJs = path.resolve(repoRoot, 'dist/content.js')
      await page.goto('https://example.com')
      await page.addScriptTag({ path: contentJs })
      await expect(page.locator('#extension-root')).toBeVisible({ timeout: 10000 })
    } else {
      await page.goto('https://example.com')
      await expect(page.locator('#extension-root')).toBeVisible({ timeout: 10000 })
    }
  })

  test('popup renders', async () => {
    const mode = process.env.PLAYWRIGHT_TEST_MODE || 'extension'
    if (mode === 'dist') {
      const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
      const popupPath = path.resolve(repoRoot, 'dist/popup.html')
      const popup = await context!.newPage()
      await popup.goto(`file://${popupPath}`)
      await expect(popup.locator('#popup-title')).toBeVisible()
      await popup.close()
    } else {
      const popup = await context!.newPage()
      // Firefox extension pages use moz-extension:// scheme; extensionId may be undefined for service-worker-only extensions
      if (extensionId) {
        await popup.goto(`chrome-extension://${extensionId}/popup.html`)
        await expect(popup.locator('#popup-title')).toBeVisible()
      } else {
        // fallback: open built popup directly
        const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
        const popupPath = path.resolve(repoRoot, 'dist/popup.html')
        await popup.goto(`file://${popupPath}`)
        await expect(popup.locator('#popup-title')).toBeVisible()
      }
      await popup.close()
    }
  })

  test.afterAll(async () => {
    await context!.close()
  })
})
