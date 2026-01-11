import { test, expect, chromium } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'

test.describe('Manifest V2 Extension', () => {
  let context: BrowserContext
  let extensionId: string

  test.beforeAll(async () => {
    // INLINE PATHS - no imports needed
const extensionPath = new URL('.', import.meta.url).pathname + '/dist';
    const profileDir = 'test/playwright/chrome-profile'

    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-web-security'
      ]
    })

    // Get extension ID
    let [background] = context.backgroundPages()
    if (!background) {
      background = await context.waitForEvent('backgroundpage')
    }
    extensionId = background.url().split('/')[2]!
    console.log('✅ Extension loaded:', extensionId)
  })

  test('content script injects', async ({ page }) => {
    await page.goto('https://example.com')
    await expect(page.locator('#extension-root')).toBeVisible({ timeout: 10000 })
  })

  test('popup renders', async () => {
    const popup = await context!.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popup.locator('#popup-title')).toBeVisible()
    await popup.close()
  })

  test.afterAll(async () => {
    await context!.close()
  })
})
