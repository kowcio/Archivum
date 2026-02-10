import { expect, chromium, test } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.describe('Simple Chromium Web Extension Test', () => {
  test.beforeAll(async () => {
    console.log('Building MV3 extension...')
    execSync('npm run build', { stdio: 'inherit' })
  })

  test('extension loads and entrypoints expose data-testid tokens (Chromium)', async () => {
    const extensionPath = path.resolve(process.cwd(), '.output', 'chrome-mv3')
    expect(fs.existsSync(extensionPath)).toBe(true)

    console.log('Loading extension from:', extensionPath)

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-'))

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })

    // Wait for service worker to start and extract extension id
    const sw = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    const swUrl = sw.url()
    const extId = new URL(swUrl).host
    console.log('Detected extension id:', extId)
    expect(extId.length).toBeGreaterThan(0)

    // Open popup page and verify data-testid
    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extId}/popup.html`)
    await popupPage.waitForLoadState('domcontentloaded')
    const popupRoot = await popupPage.locator('[data-testid="popup-root"]').first()
    await expect(popupRoot).toHaveCount(1)

    // Open options page and verify data-testid
    const optionsPage = await context.newPage()
    await optionsPage.goto(`chrome-extension://${extId}/options.html`)
    await optionsPage.waitForLoadState('domcontentloaded')
    const optionsRoot = await optionsPage.locator('[data-testid="options-root"]').first()
    await expect(optionsRoot).toHaveCount(1)

    // Navigate to example.com and wait for content script to inject UI with data-testid
    const page = await context.newPage()

    const consoleMsgs: string[] = []
    page.on('console', (msg) => {
      consoleMsgs.push(msg.text())
    })

    await page.goto('https://example.com')

    // Wait up to 5s for content-root to appear (content script may inject after load)
    const contentRoot = page.locator('[data-testid="content-root"]').first()
    await contentRoot.waitFor({ state: 'attached', timeout: 5000 })
    await expect(contentRoot).toHaveCount(1)

    // Check content script produced debug tokens in page console
    const foundToken = consoleMsgs.some((m) => m.includes('EXT-DBG') || m.includes('content-root'))
    expect(foundToken).toBe(true)

    // Wait 30 seconds for manual inspection
    console.log('⏱️  Waiting 30 seconds for manual inspection...')
    // await page.waitForTimeout(30000)

    await context.close()
  })
})
