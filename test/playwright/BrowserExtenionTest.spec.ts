import { expect, firefox, test } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'

test.describe('Browser Extension Test', () => {
  test.beforeAll(async () => {
    console.log('Building extension...')
    execSync('npm run build', { stdio: 'inherit' })

    console.log('Preparing Firefox profile with extension...')
    execSync('node scripts/prepare-firefox-profile.js', { stdio: 'inherit' })
  })

  test('extension loads in Firefox', async () => {
    const profileDir = path.resolve(process.cwd(), 'test/playwright/firefox-profile')

    // Launch Firefox with extension - launchPersistentContext automatically creates a new page
    const context = await firefox.launchPersistentContext(profileDir, {
      headless: false
    })

    // Get the first (and only) page that was created
    const [page] = context.pages()
    await page.goto('https://playwright.dev')

    // Wait for content script to inject
    await page.waitForTimeout(30000)

    const element = page.locator('#my-vue-header')
    const exists = await element.count()
    expect(exists).toBeGreaterThan(0)

    console.log(`Element count: ${exists}`)
    if (exists > 0) {
      console.log('✅ Extension loaded successfully')
      expect(exists).toBeGreaterThan(0)
    } else {
      console.log('⚠️ Extension element not found')
      // Don't fail the test, just log it
    }

    await context.close()
  })
})

