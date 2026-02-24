import { expect, test } from '@playwright/test'
import { launchFirefoxMv3Context } from './helpers/extensions'

test.describe('Simple Firefox Web Extension Test', () => {
  test.beforeAll(async () => {
    console.log('Building MV3 extension for Firefox...')
  })

  test('extension loads and entrypoints expose data-testid tokens (Firefox headless)', async () => {
    test.skip(test.info().project.name !== 'firefox-mv3', 'Run only in firefox-mv3 project')
    test.setTimeout(60000)

    test.fixme(true, 'Playwright Firefox does not reliably load MV3 extensions in headless mode.')

    const { context, extId } = await launchFirefoxMv3Context()
    console.log('Detected extension id:', extId)

    const popupPage = await context.newPage()
    await popupPage.goto(`moz-extension://${extId}/popup.html`, { waitUntil: 'domcontentloaded' })
    await expect(popupPage.getByTestId('popup-root')).toBeVisible()

    const optionsPage = await context.newPage()
    await optionsPage.goto(`moz-extension://${extId}/options.html`, { waitUntil: 'domcontentloaded' })
    await expect(optionsPage.getByTestId('options-root')).toBeVisible()

    const page = await context.newPage()
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('content-root')).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
