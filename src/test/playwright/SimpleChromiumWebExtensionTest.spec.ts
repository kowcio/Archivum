import { expect, test } from '@playwright/test'
import { launchChromeMv3Context } from './helpers/extensions.js'

test.describe('Simple Chromium Web Extension Test', () => {
  test.beforeAll(async () => {
    console.log('Building MV3 extension...')
  })

  test('extension loads and entrypoints expose data-testid tokens (Chromium)', async () => {
    test.skip(test.info().project.name !== 'chrome-mv3', 'Run only in chrome-mv3 project')
    test.setTimeout(60000)

    const { context, extId } = await launchChromeMv3Context()
    console.log('Detected extension id:', extId)

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
