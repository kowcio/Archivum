import { expect, chromium, test } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.describe('Simple Chromium Web Extension Test', () => {
  test.beforeAll(async () => {
    console.log('Building MV3 extension...')
  })

  test('extension loads and entrypoints expose data-testid tokens (Chromium)', async () => {
    test.setTimeout(60000)

    const extensionPath = path.resolve(process.cwd(), '.output', 'chrome-mv3')
    const normalizedExtensionPath = extensionPath.replace(/\\/g, '/')
    expect(fs.existsSync(extensionPath)).toBe(true)
    console.log('Loading extension from:', extensionPath)

    const userDataDir = path.resolve(process.cwd(), '.output', 'pw-profile')
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
    fs.mkdirSync(userDataDir, { recursive: true })

    const launchArgs = [
      `--disable-extensions-except=${normalizedExtensionPath}`,
      `--load-extension=${normalizedExtensionPath}`,
      '--headless=new',
    ]
    console.log('Launch args:', launchArgs)

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions', '--headless'],
      args: launchArgs,
    })

    console.log('Waiting for service worker...')
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 30000 })
    const swUrl = worker.url()
    const extId = new URL(swUrl).host
    console.log('Service worker URL:', swUrl)
    console.log('Detected extension id:', extId)
    expect(extId.length).toBeGreaterThan(0)

    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'domcontentloaded' })
    const popupRoot = popupPage.getByTestId('popup-root')
    await expect(popupRoot).toBeVisible()
    console.log('Popup root visible')

    const optionsPage = await context.newPage()
    await optionsPage.goto(`chrome-extension://${extId}/options.html`, { waitUntil: 'domcontentloaded' })
    const optionsRoot = optionsPage.getByTestId('options-root')
    await expect(optionsRoot).toBeVisible()
    console.log('Options root visible')

    const page = await context.newPage()
    const consoleMsgs: string[] = []
    page.on('console', (msg) => {
      consoleMsgs.push(msg.text())
    })

    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' })
    const contentRoot = page.getByTestId('content-root')
    await expect(contentRoot).toBeVisible({ timeout: 10000 })
    console.log('Content root visible')

    const foundToken = consoleMsgs.some((m) => m.includes('EXT-DBG') || m.includes('content-root'))
    expect(foundToken).toBe(true)
    console.log('Console messages:', consoleMsgs)

    await context.close()
  })
})
